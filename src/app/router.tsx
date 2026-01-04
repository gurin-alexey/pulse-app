
import { createBrowserRouter } from "react-router-dom";
import { Layout } from "@/shared/components/Layout";
import { DashboardPage } from "@/pages/DashboardPage";
import { TasksPage } from "@/pages/TasksPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { ProjectTasks } from "@/pages/ProjectTasks";
import { TagTasks } from "@/pages/TagTasks";

import { ProtectedRoute } from "@/shared/components/ProtectedRoute";
import { Login } from "@/pages/Login";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />,
  },
  {
    element: <ProtectedRoute />,
    children: [
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
          {
            path: "projects/:projectId",
            element: <ProjectTasks />,
          },
          {
            path: "tags/:tagId",
            element: <TagTasks />,
          },
        ],
      },
    ],
  },
]);
