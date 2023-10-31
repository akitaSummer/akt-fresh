import Counter from "../islands/Counter";

const RecursiveDivs = ({ depth = 1, breadth = 1 }) => {
  if (depth <= 0) {
    return <div>abcdefghij</div>;
  }

  let children = [];

  for (let i = 0; i < breadth; i++) {
    children.push(
      <RecursiveDivs key={i} depth={depth - 1} breadth={breadth - 1} />
    );
  }

  return (
    <div
      onClick={() => {
        console.log("clicked");
      }}
    >
      {children}
    </div>
  );
};

export default function Home() {
  return (
    <div>
      <p>
        Welcome to Fresh. Try to update this message in the ./routes/index.tsx
        file, and refresh.
      </p>
      <Counter count={3} />
      {/* <RecursiveDivs depth={5} breadth={11} /> */}
    </div>
  );
}
