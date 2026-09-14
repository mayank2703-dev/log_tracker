const STEPS = [
  { key: 1, n: '1', label: 'Environment' },
  { key: 2, n: '2', label: 'Node' },
  { key: 3, n: '3', label: 'Log type' },
  { key: 4, n: '▶', label: 'Start / Search' },
];

export default function Stepper({ active, done }) {
  return (
    <div className="steps">
      {STEPS.map((s) => {
        const state = done.includes(s.key) ? 'done' : active === s.key ? 'active' : '';
        return (
          <div className="step" data-s={state} key={s.key}>
            <span className="n">{s.n}</span> {s.label}
          </div>
        );
      })}
    </div>
  );
}
