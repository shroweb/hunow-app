<?php
/**
 * HU NOW App Endpoints
 * Add these routes to the existing plugin's register_routes() method
 * and the handler methods to the plugin class.
 *
 * ROUTES TO ADD inside register_routes():
 */

// --- Paste inside your register_rest_route block ---

register_rest_route( 'hunow/v1', '/register', [
    'methods'             => WP_REST_Server::CREATABLE,
    'callback'            => [ $this, 'handle_register' ],
    'permission_callback' => '__return_true',
    'args'                => [
        'name'     => [ 'required' => true,  'sanitize_callback' => 'sanitize_text_field' ],
        'email'    => [ 'required' => true,  'sanitize_callback' => 'sanitize_email' ],
        'password' => [ 'required' => true ],
        'role'     => [ 'required' => false, 'default' => 'customer', 'sanitize_callback' => 'sanitize_text_field' ],
    ],
] );

register_rest_route( 'hunow/v1', '/me', [
    'methods'             => WP_REST_Server::READABLE,
    'callback'            => [ $this, 'handle_me' ],
    'permission_callback' => [ $this, 'verify_jwt_token' ],
] );

register_rest_route( 'hunow/v1', '/redeem', [
    'methods'             => WP_REST_Server::CREATABLE,
    'callback'            => [ $this, 'handle_redeem' ],
    'permission_callback' => [ $this, 'verify_jwt_token' ],
] );

register_rest_route( 'hunow/v1', '/lookup-card', [
    'methods'             => WP_REST_Server::CREATABLE,
    'callback'            => [ $this, 'handle_lookup_card' ],
    'permission_callback' => [ $this, 'verify_jwt_token' ],
    'args'                => [
        'card_token' => [ 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ],
    ],
] );


/**
 * HANDLER METHODS — Add these to the plugin class body
 */

/**
 * POST /hunow/v1/register
 * Creates a WP user, generates a card token, awards welcome points, returns JWT.
 */
public function handle_register( WP_REST_Request $request ) {
    $name     = $request->get_param( 'name' );
    $email    = $request->get_param( 'email' );
    $password = $request->get_param( 'password' );
    $role     = in_array( $request->get_param( 'role' ), [ 'customer', 'business' ], true )
                ? $request->get_param( 'role' )
                : 'customer';

    if ( ! is_email( $email ) ) {
        return new WP_Error( 'invalid_email', 'Please provide a valid email address.', [ 'status' => 400 ] );
    }

    if ( email_exists( $email ) ) {
        return new WP_Error( 'email_exists', 'An account with this email already exists.', [ 'status' => 409 ] );
    }

    // Generate unique username from email prefix
    $base     = sanitize_user( strstr( $email, '@', true ) );
    $username = $base;
    $suffix   = 1;
    while ( username_exists( $username ) ) {
        $username = $base . $suffix++;
    }

    $user_id = wp_create_user( $username, $password, $email );
    if ( is_wp_error( $user_id ) ) {
        return $user_id;
    }

    wp_update_user( [
        'ID'           => $user_id,
        'display_name' => $name,
        'first_name'   => $name,
    ] );

    // Store HU NOW role and card token
    update_user_meta( $user_id, 'hunow_role',         $role );
    update_user_meta( $user_id, 'hunow_venue_id',     0 );   // set later by business users

    $card_token = wp_generate_uuid4();
    update_user_meta( $user_id, 'hunow_card_token',   $card_token );
    update_user_meta( $user_id, 'hunow_card_created', current_time( 'mysql' ) );
    update_user_meta( $user_id, 'hunow_points',       0 );
    update_user_meta( $user_id, 'hunow_redemptions',  [] );

    // Award welcome points via existing plugin hook
    do_action( 'hunow_award_points', $user_id, 'registration', 'Welcome to HU NOW!', 10 );

    // Generate JWT using the JWT Auth plugin's own signing logic
    $token = $this->generate_token_for_user( $user_id );
    if ( is_wp_error( $token ) ) {
        return $token;
    }

    return rest_ensure_response( [
        'token'        => $token,
        'user_id'      => $user_id,
        'display_name' => $name,
        'email'        => $email,
        'role'         => $role,
        'card_token'   => $card_token,
        'card_created' => current_time( 'mysql' ),
        'points'       => 10,
    ] );
}

/**
 * GET /hunow/v1/me
 * Returns the current authenticated user's profile + card info.
 */
public function handle_me( WP_REST_Request $request ) {
    $user = wp_get_current_user();
    if ( ! $user || ! $user->ID ) {
        return new WP_Error( 'not_authenticated', 'Not authenticated.', [ 'status' => 401 ] );
    }

    // Ensure card token exists (for legacy users migrated to app)
    $card_token = get_user_meta( $user->ID, 'hunow_card_token', true );
    if ( ! $card_token ) {
        $card_token = wp_generate_uuid4();
        update_user_meta( $user->ID, 'hunow_card_token',   $card_token );
        update_user_meta( $user->ID, 'hunow_card_created', current_time( 'mysql' ) );
    }

    $role         = get_user_meta( $user->ID, 'hunow_role',         true ) ?: 'customer';
    $venue_id     = (int) get_user_meta( $user->ID, 'hunow_venue_id', true );
    $points       = (int) get_user_meta( $user->ID, 'hunow_points',   true );
    $card_created = get_user_meta( $user->ID, 'hunow_card_created',  true );

    // Recent redemptions (last 10)
    $all_redemptions = get_user_meta( $user->ID, 'hunow_redemptions', true ) ?: [];
    $recent          = array_slice( array_reverse( $all_redemptions ), 0, 10 );

    return rest_ensure_response( [
        'user_id'      => $user->ID,
        'display_name' => $user->display_name,
        'email'        => $user->user_email,
        'role'         => $role,
        'card_token'   => $card_token,
        'card_created' => $card_created,
        'points'       => $points,
        'venue_id'     => $venue_id,
        'redemptions'  => $recent,
    ] );
}

/**
 * POST /hunow/v1/redeem
 * Business staff scan a customer card and redeem an offer.
 * Validates card token, verifies offer exists on venue, awards points.
 *
 * Body: { card_token, offer_title, offer_index, wp_post_id }
 */
public function handle_redeem( WP_REST_Request $request ) {
    $staff_user  = wp_get_current_user();
    if ( ! $staff_user || ! $staff_user->ID ) {
        return new WP_Error( 'not_authenticated', 'Not authenticated.', [ 'status' => 401 ] );
    }

    // Staff must be business role
    $staff_role = get_user_meta( $staff_user->ID, 'hunow_role', true );
    if ( $staff_role !== 'business' ) {
        return new WP_Error( 'forbidden', 'Only business accounts can redeem offers.', [ 'status' => 403 ] );
    }

    $card_token  = sanitize_text_field( $request->get_param( 'card_token' ) );
    $offer_title = sanitize_text_field( $request->get_param( 'offer_title' ) );
    $offer_index = (int) $request->get_param( 'offer_index' );
    $wp_post_id  = (int) $request->get_param( 'wp_post_id' );

    if ( ! $card_token || ! $offer_title || ! $wp_post_id ) {
        return new WP_Error( 'missing_params', 'card_token, offer_title, and wp_post_id are required.', [ 'status' => 400 ] );
    }

    // Find member by card token
    $member_query = new WP_User_Query( [
        'meta_key'   => 'hunow_card_token',
        'meta_value' => $card_token,
        'number'     => 1,
    ] );
    $members = $member_query->get_results();
    if ( empty( $members ) ) {
        return new WP_Error( 'invalid_card', 'Invalid HU NOW card.', [ 'status' => 404 ] );
    }
    $member = $members[0];

    // Verify the venue post exists
    $venue = get_post( $wp_post_id );
    if ( ! $venue ) {
        return new WP_Error( 'invalid_venue', 'Venue not found.', [ 'status' => 404 ] );
    }

    // Verify offer exists on this venue — check both ACF repeater and legacy offer_title_1-20 fields
    $offer_valid = false;

    // Check offers repeater (venue portal system)
    $offers_repeater = get_field( 'offers', $wp_post_id );
    if ( is_array( $offers_repeater ) ) {
        foreach ( $offers_repeater as $row ) {
            $row_title = isset( $row['offer_title'] ) ? trim( $row['offer_title'] ) : '';
            if ( $row_title && $row_title === trim( $offer_title ) ) {
                $offer_valid = true;
                break;
            }
        }
    }

    // Fallback: legacy offer_title_1 … offer_title_20 ACF fields
    if ( ! $offer_valid ) {
        for ( $i = 1; $i <= 20; $i++ ) {
            $title = get_field( "offer_title_{$i}", $wp_post_id );
            if ( $title && trim( $title ) === trim( $offer_title ) ) {
                $offer_valid = true;
                break;
            }
        }
    }

    // Final fallback: single offer_title ACF field
    if ( ! $offer_valid ) {
        $single = get_field( 'offer_title', $wp_post_id );
        if ( $single && trim( $single ) === trim( $offer_title ) ) {
            $offer_valid = true;
        }
    }

    if ( ! $offer_valid ) {
        return new WP_Error( 'invalid_offer', 'Offer not found on this venue.', [ 'status' => 404 ] );
    }

    // Record redemption in member's user meta
    $redemptions   = get_user_meta( $member->ID, 'hunow_redemptions', true ) ?: [];
    $redemptions[] = [
        'offer_title'  => $offer_title,
        'venue_id'     => $wp_post_id,
        'venue_name'   => get_the_title( $wp_post_id ),
        'redeemed_by'  => $staff_user->ID,
        'timestamp'    => current_time( 'timestamp' ),
        'date'         => current_time( 'mysql' ),
    ];
    update_user_meta( $member->ID, 'hunow_redemptions', $redemptions );

    // Award points: 10pts QR scan + 25pts redemption
    do_action( 'hunow_award_points', $member->ID, 'qr_scan',       'QR scan at ' . get_the_title( $wp_post_id ), 10 );
    do_action( 'hunow_award_points', $member->ID, 'offer_redeemed', 'Redeemed: ' . $offer_title,                  25 );

    return rest_ensure_response( [
        'success'        => true,
        'member_name'    => $member->display_name,
        'offer'          => $offer_title,
        'venue'          => get_the_title( $wp_post_id ),
        'points_awarded' => 35,
    ] );
}

/**
 * POST /hunow/v1/lookup-card
 * Business staff validate a QR code before showing the redeem modal.
 * Returns the member's name and points — does NOT record any redemption.
 *
 * Body: { card_token }
 */
public function handle_lookup_card( WP_REST_Request $request ) {
    $staff_user = wp_get_current_user();
    $staff_role = get_user_meta( $staff_user->ID, 'hunow_role', true );
    if ( $staff_role !== 'business' ) {
        return new WP_Error( 'forbidden', 'Only business accounts can look up cards.', [ 'status' => 403 ] );
    }

    $card_token = sanitize_text_field( $request->get_param( 'card_token' ) );

    $query   = new WP_User_Query( [
        'meta_key'   => 'hunow_card_token',
        'meta_value' => $card_token,
        'number'     => 1,
    ] );
    $members = $query->get_results();

    if ( empty( $members ) ) {
        return new WP_Error( 'invalid_card', 'Invalid HU NOW card.', [ 'status' => 404 ] );
    }

    $member = $members[0];
    $points = (int) get_user_meta( $member->ID, 'hunow_points', true );

    return rest_ensure_response( [
        'valid'   => true,
        'name'    => $member->display_name,
        'user_id' => $member->ID,
        'points'  => $points,
    ] );
}

/**
 * PRIVATE — Generate a JWT token for a given user ID using
 * the same logic as the JWT Authentication for WP REST API plugin.
 * Must be called after the JWT plugin has been loaded.
 */
private function generate_token_for_user( int $user_id ) {
    $secret_key = defined( 'JWT_AUTH_SECRET_KEY' ) ? JWT_AUTH_SECRET_KEY : false;
    if ( ! $secret_key ) {
        return new WP_Error( 'jwt_auth_bad_config', 'JWT is not configured. Set JWT_AUTH_SECRET_KEY in wp-config.php.', [ 'status' => 500 ] );
    }

    $user       = get_user_by( 'id', $user_id );
    $issued_at  = time();
    $expire     = apply_filters( 'jwt_auth_expire', $issued_at + ( DAY_IN_SECONDS * 7 ), $issued_at );

    $payload = apply_filters( 'jwt_auth_token_before_sign', [
        'iss'  => get_bloginfo( 'url' ),
        'iat'  => $issued_at,
        'nbf'  => $issued_at,
        'exp'  => $expire,
        'data' => [ 'user' => [ 'id' => $user_id ] ],
    ], $user );

    return \Firebase\JWT\JWT::encode( $payload, $secret_key, 'HS256' );
}
