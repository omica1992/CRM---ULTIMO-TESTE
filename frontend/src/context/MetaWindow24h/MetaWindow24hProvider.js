import React, { useState } from "react";
import MetaWindow24hContext from "./MetaWindow24hContext";

const MetaWindow24hProvider = ({ children }) => {
  const [is24HourWindowExpired, setIs24HourWindowExpired] = useState(false);

  return (
    <MetaWindow24hContext.Provider
      value={{ is24HourWindowExpired, setIs24HourWindowExpired }}
    >
      {children}
    </MetaWindow24hContext.Provider>
  );
};

export default MetaWindow24hProvider;
