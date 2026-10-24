import { Link } from "react-router-dom";
import { Empty } from "../components/ui";

export default function NotFound() {
  return (
    <Empty title="Page not found">
      <Link to="/">Go to the home page</Link>
    </Empty>
  );
}
