
import { createBrowserRouter } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { DashboardPage } from "@/pages/DashboardPage";
import { TasksPage } from "@/pages/TasksPage";
import { CalendarPage } from "@/pages/CalendarPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "tasks",
        element: <TasksPage />,
      },
      {
        path: "calendar",
        element: <CalendarPage />,
      },
    ],
  },
]);
