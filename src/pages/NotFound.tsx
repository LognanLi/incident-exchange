import { Link } from "react-router-dom";
import { Icon } from "../components/icons";

export default function NotFound() {
  return (
    <div className="gate">
      <div className="eyebrow">404</div>
      <h2>Page not found</h2>
      <p>
        <Link className="arrow-link" to="/">
          Go home <Icon name="arrow" size={16} />
        </Link>
      </p>
    </div>
  );
}
