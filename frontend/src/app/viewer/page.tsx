"use client";

import React, { Suspense } from "react";
import Viewer from "./Viewer";

export default function ViewerPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Viewer />
    </Suspense>
  );
}