export default function Scoreboard({ scores, players, mode }) {
  const team0 = players.filter(p => p.team === 0).map(p => p.name).join(' & ')
  const team1 = players.filter(p => p.team === 1).map(p => p.name).join(' & ')
  const limit = mode === 'troco' ? 24 : 12

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-[9px] text-white/40 truncate max-w-[90px]">{team0}</div>
        <div className="text-xl font-bold font-display text-blue-300 leading-tight">{scores[0]}</div>
        <div className="text-[8px] text-white/20">/{limit}</div>
      </div>
      <div className="text-white/30 font-bold text-sm">×</div>
      <div className="text-left">
        <div className="text-[9px] text-white/40 truncate max-w-[90px]">{team1}</div>
        <div className="text-xl font-bold font-display text-red-300 leading-tight">{scores[1]}</div>
        <div className="text-[8px] text-white/20">/{limit}</div>
      </div>
    </div>
  )
}
