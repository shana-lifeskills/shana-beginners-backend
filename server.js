require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const swaggerUi = require("swagger-ui-express");
const { sequelize } = require("./src/models");
const { errorHandler } = require("./src/middleware/errorHandler");

const authRoutes = require("./src/routes/auth");
const moduleRoutes = require("./src/routes/modules");
const lessonRoutes = require("./src/routes/lessons");
const userRoutes = require("./src/routes/users");
const enrollmentRoutes = require("./src/routes/enrollments");
const studentRoutes = require("./src/routes/students");
const progressRoutes = require("./src/routes/progress");
const assignmentRoutes = require("./src/routes/moduleAssignments");
const paymentRoutes = require("./src/routes/payments");

let openapiSpec = {};
try {
  openapiSpec = JSON.parse(
    require("fs").readFileSync(
      path.join(__dirname, "docs", "openapi.json"),
      "utf8",
    ),
  );
} catch (err) {
  console.warn("Could not load docs/openapi.json:", err.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

const defaultOrigins = ["http://localhost:3000", "http://localhost:4200"];
const envOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((s) => s.trim()).filter(Boolean)
  : [];
const clientOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || clientOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(morgan("dev"));
// Paystack's webhook signature is computed over the raw body, so this one path
// must see it as an unparsed Buffer — registered ahead of the global JSON
// parser, which skips paths body-parser has already consumed.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
  }),
);

app.use("/api/auth", authRoutes);
app.use("/api/modules", moduleRoutes);
app.use("/api/lessons", lessonRoutes);
app.use("/api/users", userRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/payments", paymentRoutes);

app.use(errorHandler);

async function start() {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully.");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Unable to start server:", error);
    process.exit(1);
  }
}

start();
