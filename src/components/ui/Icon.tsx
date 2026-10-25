import '../../styles/fonts.css';

export function Icon({ name }: { name: string }) {
  return (
    <span className="material-icon" aria-hidden="true">
      {name}
    </span>
  );
}
