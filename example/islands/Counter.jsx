import { useState } from "preact/hooks";

export const handler = () => {};

export default function Counter({ count }) {
  const [value, setValue] = useState(count);
  return (
    <div>
      <p>{value}</p>
      <button onClick={() => setValue(value - 1)}>-1</button>
      <button onClick={() => setValue(value + 1)}>+1</button>
    </div>
  );
}
