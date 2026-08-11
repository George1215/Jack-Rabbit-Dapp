// src/pages/Staking.js
import React from "react";
import { Routes, Route } from "react-router-dom";
import Diamond from "./Diamond";
import Jackies from "./Jackies";

export default function Staking() {
  return (
    <Routes>
      <Route index element={<Diamond />} />
      <Route path="jackies" element={<Jackies />} />
    </Routes>
  );
}
