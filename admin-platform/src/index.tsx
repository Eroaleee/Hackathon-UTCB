import "@arcgis/core/assets/esri/themes/dark/main.css";
import React from "react";
import ReactDOM from "react-dom/client";
import AdminApp from "./pages/AdminApp";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
