import { Building2 } from "lucide-react";
import { Link } from "react-router-dom";

const Logo = ({ linkTo = "/" }: { linkTo?: string }) => (
  <Link to={linkTo} className="flex items-center gap-2 group">
    <div className="p-1.5 rounded-lg bg-primary text-primary-foreground">
      <Building2 className="w-6 h-6" />
    </div>
    <span className="font-display text-xl font-bold text-foreground tracking-tight">
      dakiy<span className="text-primary">Builds</span>
    </span>
  </Link>
);

export default Logo;
