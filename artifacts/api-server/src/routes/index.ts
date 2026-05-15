import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import vendorsRouter from "./vendors";
import reviewsRouter from "./reviews";
import bookingsRouter from "./bookings";
import favoritesRouter from "./favorites";
import checklistRouter from "./checklist";
import budgetRouter from "./budget";
import statsRouter from "./stats";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/categories", categoriesRouter);
router.use("/vendors", vendorsRouter);
router.use("/vendors/:id/reviews", reviewsRouter);
router.use("/bookings", bookingsRouter);
router.use("/favorites", favoritesRouter);
router.use("/checklist", checklistRouter);
router.use("/budget", budgetRouter);
router.use("/stats", statsRouter);
router.use("/admin", adminRouter);

export default router;
