/**
 * @param {Object} props
 * @param {number} props.percent - 0 a 100
 * @param {string} [props.color] - color del trazo activo
 * @param {number} [props.size] - diámetro en px (default 180, más chico que el de la agencia individual)
 * @param {string} [props.label] - texto bajo el porcentaje (default "COMPLETADO")
 */
export default function ProgressRing({ percent, color = '#4F46E5', size = 180, label = 'COMPLETADO' }) {
  const strokeWidth = size * 0.08
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} stroke="#f1f5f9" strokeWidth={strokeWidth} fill="transparent" />
        <circle
          cx={center} cy={center} r={radius} stroke={color} strokeWidth={strokeWidth} fill="transparent"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-extrabold text-slate-900" style={{ fontSize: size * 0.19 }}>{percent}%</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{label}</span>
      </div>
    </div>
  )
}
