"use client";

import { useState } from "react";
import Header2 from "./header/Header2";

export default function Header2Wrapper({ children }) {
  const [isMobileMenu, setMobileMenu] = useState(false);

  const handleMobileMenu = () => {
    setMobileMenu((prev) => !prev);
  };

  return (
    <Header2
      isMobileMenu={isMobileMenu}
      handleMobileMenu={handleMobileMenu}
      notificationBell={children}
    />
  );
}
