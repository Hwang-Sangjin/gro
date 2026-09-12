"use client";

import { createContext, useCallback, useContext, useState } from "react";

// done: 인트로가 끝났는가. layout에 있으므로 라우트가 바뀌어도 유지된다.
const IntroContext = createContext({ done: true, finish: () => {} });

export const useIntro = () => useContext(IntroContext);

export function IntroProvider({ children }) {
  const [done, setDone] = useState(false);
  const finish = useCallback(() => setDone(true), []);

  return (
    <IntroContext.Provider value={{ done, finish }}>
      {children}
    </IntroContext.Provider>
  );
}
