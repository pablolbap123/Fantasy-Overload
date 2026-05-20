import { useEffect, useState } from "react";
import { preferenceStorage } from "../utils/storage";

export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [value, setValue] = useState<T>(() => preferenceStorage.get(key, initialValue));

  useEffect(() => {
    preferenceStorage.set(key, value);
  }, [key, value]);

  return [value, setValue] as const;
};
