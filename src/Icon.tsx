export function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <img
      className={`drawn-icon ${className}`}
      src={`/icons/${name}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
