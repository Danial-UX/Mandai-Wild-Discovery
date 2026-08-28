// FactsView — renders species name + three fact cards on a confident ID (Requirement 1, 3.5).

export default function FactsView({ species, facts }) {
  return (
    <div className="response">
      <h2 className="species-name">{species}</h2>
      <div className="facts">
        {facts.map((fact, i) => (
          <div className="fact-card" key={i}>
            {fact}
          </div>
        ))}
      </div>
    </div>
  );
}
