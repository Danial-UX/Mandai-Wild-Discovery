// Passport — renders the Wild Passport grid + achievement badge (Requirement 9.2-9.5).

export default function Passport({ species, badge }) {
  if (species.length === 0) return null;
  return (
    <section className="section">
      <h3>
        Wild Passport
        {badge && <span className="badge">{badge}</span>}
      </h3>
      <div className="passport-grid">
        {species.map((name) => (
          <div className="passport-card" key={name}>
            {name}
          </div>
        ))}
      </div>
    </section>
  );
}
