import express from "express";
import cors from "cors";
import { redeemRouter } from "./routes/redeem";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/redeem", redeemRouter);

app.listen(PORT, () => {
  console.log(`HU NOW API running on port ${PORT}`);
});
