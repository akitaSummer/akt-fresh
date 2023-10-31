import fetch from "node-fetch";
import Counter from "../islands/Counter";

export const handler = async () => {
  const res = await fetch("https://api.github.com/users/xiaotian/repos");
  const repos = await res.json();
  const data = { data: [] };
  for (const repo of repos) {
    data.data.push(repo.name);
  }
  return data;
};

export default function Home(props) {
  return (
    <div>
      {props.data.map((name) => (
        <p>{name}</p>
      ))}

      <Counter count={3} />
    </div>
  );
}
