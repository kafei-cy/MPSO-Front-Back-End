import type { SVGProps } from 'react'

export type ProtocolTopologyVariant = 'mpsi' | 'mpsu' | 'mpsic'
export type ProtocolTrafficMode = 'mpsi' | 'mpsu' | 'mpsic' | 'mpsics'

type ProtocolTopologyProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  variant: ProtocolTopologyVariant
  trafficMode?: ProtocolTrafficMode
}

type NodeProps = {
  x: number
  y: number
  label: string
  role: string
  central?: boolean
}

const topologyCopy: Record<
  ProtocolTopologyVariant,
  { title: string; accent: string; description: string; footer: string }
> = {
  mpsi: {
    title: 'MPSI',
    accent: 'P0 中心星型',
    description: '四方示例：仅 P0 与各参与方双向传输数据，外围节点之间不直接通信。',
    footer: '所有数据交换均由 P0 协调，外围参与方之间不建立直接传输链路。',
  },
  mpsu: {
    title: 'MPSU',
    accent: 'Mesh + P0 星型 + 链式 Shuffle',
    description: '两两 PMT、P0 星型聚合与多方 Shuffle 共用同一组参与节点。',
    footer: '执行顺序：两两 PMT → P0 份额聚合 → 汇聚后按 P0 → P1 → P2 → P3 置换。',
  },
  mpsic: {
    title: 'MPSI-card 系列',
    accent: '共用通信拓扑',
    description: '交集数量与交集求和使用相同的 P0 星型和多方 Shuffle 链路。',
    footer: 'MPSI-card：执行 1 次 XOR Shuffle；MPSI-card-sum：先后执行 XOR 与 ADD 两次 Shuffle。',
  },
}

function ServerGlyph({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true">
      <path
        d="M8 2h40l8 8v42a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V10z"
        fill="#10271f"
        stroke="#00ff99"
        strokeWidth="2"
      />
      <path d="M8 2h40l8 8H0z" fill="#00ff99" opacity="0.9" />
      <path d="M0 30h56" stroke="#00ff99" strokeWidth="2" />
      <circle cx="10" cy="20" r="3" fill="none" stroke="#00ff99" strokeWidth="2" />
      <circle cx="20" cy="20" r="3" fill="none" stroke="#00ff99" strokeWidth="2" />
      <circle cx="10" cy="43" r="3" fill="none" stroke="#00ff99" strokeWidth="2" />
      <circle cx="20" cy="43" r="3" fill="none" stroke="#00ff99" strokeWidth="2" />
      <path d="M31 20h16M31 43h16" stroke="#00ff99" strokeWidth="2" strokeLinecap="round" />
    </g>
  )
}

function ProtocolNode({ x, y, label, role, central = false }: NodeProps) {
  const width = central ? 160 : 130
  const height = central ? 194 : 164
  const iconScale = central ? 1.35 : 1
  const iconWidth = 56 * iconScale

  return (
    <g transform={`translate(${x} ${y})`}>
      {central && (
        <rect
          x="-7"
          y="-7"
          width={width + 14}
          height={height + 14}
          rx="22"
          fill="none"
          stroke="#00ff99"
          strokeWidth="2"
          opacity="0.4"
        />
      )}
      <rect
        width={width}
        height={height}
        rx={central ? 18 : 14}
        fill="url(#topology-node-surface)"
        stroke={central ? '#2563eb' : '#00ff99'}
        strokeWidth={central ? 2.5 : 1.5}
      />
      <ServerGlyph x={(width - iconWidth) / 2} y={central ? 24 : 22} scale={iconScale} />
      <text
        x={width / 2}
        y={central ? 134 : 111}
        fill="#ffffff"
        fontSize={central ? 30 : 25}
        fontWeight="700"
        textAnchor="middle"
      >
        {label}
      </text>
      <text
        x={width / 2}
        y={central ? 166 : 141}
        fill="#b7c2bc"
        fontSize={central ? 20 : 18}
        textAnchor="middle"
      >
        {role}
      </text>
    </g>
  )
}

function LinkLabel({ x, y, title, detail, color }: {
  x: number
  y: number
  title: string
  detail: string
  color: string
}) {
  return (
    <g>
      <text
        x={x}
        y={y}
        fill={color}
        stroke="#0d1511"
        strokeWidth="6"
        strokeLinejoin="round"
        paintOrder="stroke"
        fontSize="20"
        fontWeight="650"
        textAnchor="middle"
      >
        {title}
      </text>
      <text
        x={x}
        y={y + 23}
        fill="#b7c2bc"
        stroke="#0d1511"
        strokeWidth="6"
        strokeLinejoin="round"
        paintOrder="stroke"
        fontSize="17"
        textAnchor="middle"
      >
        {detail}
      </text>
    </g>
  )
}

function StarLinks({ markerId }: { markerId: string }) {
  const marker = `url(#${markerId})`

  return (
    <g fill="none" stroke="#2563eb" strokeWidth="3" markerStart={marker} markerEnd={marker}>
      <path d="M240 327H508" />
      <path d="M692 277L960 218" />
      <path d="M692 357L960 436" />
    </g>
  )
}

function StarLabels({ withShuffle = false }: { withShuffle?: boolean }) {
  return (
    <g>
      <LinkLabel x={378} y={withShuffle ? 365 : 278} title="星型通道" detail="双向传输" color="#2563eb" />
      <LinkLabel x={822} y={203} title="星型通道" detail="双向传输" color="#2563eb" />
      <LinkLabel x={824} y={428} title="星型通道" detail="双向传输" color="#2563eb" />
    </g>
  )
}

const starIncomingPaths = [
  'M235 327H520',
  'M965 217L680 280',
  'M965 437L680 354',
]

const starOutgoingPaths = [
  'M520 327H235',
  'M680 280L965 217',
  'M680 354L965 437',
]

const shuffleForwardPaths = [
  'M520 278H235',
  'M195 245V139H916Q946 139 965 174',
  'M1030 299V355',
]

function DataPacket({ path, label, color, start, end, duration = 10 }: {
  path: string
  label: string
  color: string
  start: number
  end: number
  duration?: number
}) {
  const fadeIn = Math.max(0, start - 0.015)
  const fadeOut = Math.min(1, end + 0.015)

  return (
    <g opacity="0" className="protocol-packet-motion">
      <rect x="-23" y="-9" width="46" height="18" rx="4" fill="#0d1511" stroke={color} strokeWidth="1.4" />
      <circle cx="-15" cy="0" r="3" fill={color} />
      <text x="5" y="4" fill="#ffffff" fontSize="11" fontWeight="700" textAnchor="middle">{label}</text>
      <animateMotion
        path={path}
        dur={`${duration}s`}
        repeatCount="indefinite"
        rotate="0"
        calcMode="linear"
        keyPoints="0;0;1;1"
        keyTimes={`0;${start};${end};1`}
      />
      <animate
        attributeName="opacity"
        dur={`${duration}s`}
        repeatCount="indefinite"
        values="0;0;1;1;0;0"
        keyTimes={`0;${fadeIn};${start};${end};${fadeOut};1`}
      />
    </g>
  )
}

function PhaseLabel({ text, start, end, duration = 10, initiallyVisible = false }: {
  text: string
  start: number
  end: number
  duration?: number
  initiallyVisible?: boolean
}) {
  const fadeIn = Math.max(0, start - 0.01)
  const fadeOut = Math.min(1, end + 0.01)

  return (
    <text
      x="600"
      y="111"
      fill="#b7c2bc"
      fontSize="18"
      fontWeight="650"
      textAnchor="middle"
      opacity={initiallyVisible ? 1 : 0}
      className="protocol-phase-motion"
    >
      {text}
      <animate
        attributeName="opacity"
        dur={`${duration}s`}
        repeatCount="indefinite"
        values={initiallyVisible ? '1;1;0;0;1' : '0;0;1;1;0;0'}
        keyTimes={
          initiallyVisible
            ? `0;${end};${fadeOut};0.99;1`
            : `0;${fadeIn};${start};${end};${fadeOut};1`
        }
      />
    </text>
  )
}

function MpsiTraffic() {
  const duration = 18

  return (
    <g>
      <g aria-hidden="true">
        <circle cx="405" cy="106" r="4" fill="#2563eb" className="protocol-phase-motion" />
        <PhaseLabel text="OPPRF 上行 · P1 / P2 / P3 → P0" start={0} end={0.24} duration={duration} initiallyVisible />
        <PhaseLabel text="Beaver 聚合 · 屏蔽份额 → P0" start={0.27} end={0.44} duration={duration} />
        <PhaseLabel text="Beaver 广播 · P0 → P1 / P2 / P3" start={0.46} end={0.62} duration={duration} />
        <PhaseLabel text="结果重构 · P1 / P2 / P3 → P0" start={0.66} end={0.88} duration={duration} />
      </g>

      <g aria-hidden="true">
        {starIncomingPaths.map((path) => (
          <DataPacket key={`opprf-${path}`} path={path} label="OPPRF" color="#2563eb" start={0.04} end={0.2} duration={duration} />
        ))}
        {starIncomingPaths.map((path) => (
          <DataPacket key={`beaver-in-${path}`} path={path} label="x⊕a" color="#a78bfa" start={0.3} end={0.42} duration={duration} />
        ))}
        {starOutgoingPaths.map((path) => (
          <DataPacket key={`beaver-out-${path}`} path={path} label="⊕sum" color="#f59e0b" start={0.49} end={0.59} duration={duration} />
        ))}
        {starIncomingPaths.map((path) => (
          <DataPacket key={`result-${path}`} path={path} label="share" color="#00d978" start={0.69} end={0.84} duration={duration} />
        ))}
      </g>
    </g>
  )
}

function ShuffleLinks({ markerId }: { markerId: string }) {
  const marker = `url(#${markerId})`
  const common = {
    fill: 'none',
    stroke: '#00d978',
    strokeWidth: 3,
    markerEnd: marker,
  }

  return (
    <g>
      <path d="M513 278H240" {...common} />
      <path d="M195 245V139H916Q946 139 960 169" {...common} />
      <path d="M1030 299V350" {...common} />
    </g>
  )
}

function ShuffleLabels() {
  return (
    <g>
      <LinkLabel x={378} y={218} title="链式 Shuffle" detail="单向传递" color="#00d978" />
      <LinkLabel x={650} y={168} title="链式 Shuffle" detail="P1 → P2" color="#00d978" />
      <LinkLabel x={1103} y={322} title="Shuffle" detail="P2 → P3" color="#00d978" />
    </g>
  )
}

function NoDirectLinks() {
  return (
    <g fill="none" stroke="#6b7280" strokeWidth="2" strokeDasharray="8 7" opacity="0.75">
      <path d="M170 245V168Q170 150 188 150H965" />
      <path d="M170 409V473Q170 492 189 492H965" />
      <path d="M1030 299V355" />
      <g fill="#0d1511" stroke="#6b7280" strokeDasharray="none">
        <circle cx="590" cy="150" r="17" />
        <circle cx="590" cy="492" r="17" />
        <circle cx="1030" cy="327" r="17" />
      </g>
      <g stroke="#b7c2bc" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="none">
        <path d="M582 142l16 16m0-16l-16 16" />
        <path d="M582 484l16 16m0-16l-16 16" />
        <path d="M1022 319l16 16m0-16l-16 16" />
      </g>
      <g fill="#b7c2bc" stroke="none" fontSize="16" textAnchor="middle">
        <text x="590" y="182">无直接连接</text>
        <text x="590" y="524">无直接连接</text>
        <text x="1100" y="332">无直连</text>
      </g>
    </g>
  )
}

function Legend({ variant }: { variant: ProtocolTopologyVariant }) {
  const hasShuffle = variant !== 'mpsi'
  const width = 286
  const height = 126

  return (
    <g transform={`translate(28 ${650 - height})`}>
      <rect width={width} height={height} rx="10" fill="#0d1511" stroke="#2a3d34" strokeWidth="1.25" />
      <ServerGlyph x={20} y={14} scale={0.52} />
      <text x="68" y="40" fill="#ffffff" fontSize="18">主机节点</text>
      <g transform="translate(20 75)">
        <path d="M0 0h42" stroke="#2563eb" strokeWidth="2.5" />
        <path d="M7-5L0 0l7 5M35-5l7 5-7 5" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="62" y="5" fill="#b7c2bc" fontSize="16">P0 星型双向通道</text>
      </g>
      {hasShuffle && (
        <g transform="translate(20 105)">
          <path d="M-7 0h49" stroke="#00d978" strokeWidth="2.5" />
          <path d="M35-5l7 5-7 5" fill="none" stroke="#00d978" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <text x="62" y="5" fill="#b7c2bc" fontSize="16">多方 Shuffle 主链路</text>
        </g>
      )}
      {variant === 'mpsi' && (
        <g transform="translate(20 105)">
          <path d="M-7 0h49" stroke="#6b7280" strokeWidth="2" strokeDasharray="7 6" />
          <text x="62" y="5" fill="#b7c2bc" fontSize="16">外围节点无直连</text>
        </g>
      )}
    </g>
  )
}

function MpsuMeshLinks() {
  return (
    <g fill="none" stroke="#6b7280" strokeWidth="2" strokeDasharray="8 7" opacity="0.82">
      <path d="M235 380H520" />
      <path d="M145 245V185H965" />
      <path d="M145 409V496H965" />
      <path d="M680 248C790 194 864 194 965 198" />
      <path d="M680 388C790 455 864 470 965 470" />
      <path d="M965 270H930V385H965" />
    </g>
  )
}

function MpsuLegend() {
  return (
    <g transform="translate(28 510)">
      <rect width="286" height="140" rx="10" fill="#0d1511" stroke="#2a3d34" strokeWidth="1.25" />
      <ServerGlyph x={20} y={13} scale={0.52} />
      <text x="68" y="39" fill="#ffffff" fontSize="18">主机节点</text>
      <g transform="translate(20 69)">
        <path d="M-7 0h49" stroke="#6b7280" strokeWidth="2" strokeDasharray="7 6" />
        <text x="62" y="5" fill="#b7c2bc" fontSize="16">PMT OT 两两通信</text>
      </g>
      <g transform="translate(20 96)">
        <path d="M0 0h42" stroke="#2563eb" strokeWidth="2.5" />
        <path d="M7-5L0 0l7 5M35-5l7 5-7 5" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="62" y="5" fill="#b7c2bc" fontSize="16">P0 星型双向通道</text>
      </g>
      <g transform="translate(20 123)">
        <path d="M-7 0h49" stroke="#00d978" strokeWidth="2.5" />
        <path d="M35-5l7 5-7 5" fill="none" stroke="#00d978" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <text x="62" y="5" fill="#b7c2bc" fontSize="16">多方 Shuffle 主链路</text>
      </g>
    </g>
  )
}

function MpsuTraffic() {
  const duration = 24
  const pmtPaths = [
    'M520 380H235',
    'M680 248C790 194 864 194 965 198',
    'M680 388C790 455 864 470 965 470',
    'M145 245V185H965',
    'M145 409V496H965',
    'M965 270H930V385H965',
  ]

  return (
    <g>
      <g aria-hidden="true">
        <circle cx="340" cy="106" r="4" fill="#2563eb" className="protocol-phase-motion" />
        <PhaseLabel text="PMT OT · P0→P1/P2/P3，P1→P2/P3，P2→P3" start={0} end={0.2} duration={duration} initiallyVisible />
        <PhaseLabel text="Beaver 乘法 · 参与方 ⇄ P0" start={0.22} end={0.43} duration={duration} />
        <PhaseLabel text="多方 Shuffle · 各方 → P0 → P1 → P2 → P3" start={0.46} end={0.82} duration={duration} />
        <PhaseLabel text="并集重构 · P1 / P2 / P3 → P0" start={0.84} end={0.96} duration={duration} />
      </g>

      <g aria-hidden="true">
        {pmtPaths.map((path) => (
          <DataPacket key={`pmt-${path}`} path={path} label="PMT" color="#a78bfa" start={0.04} end={0.17} duration={duration} />
        ))}
        {starIncomingPaths.map((path) => (
          <DataPacket key={`mpsu-beaver-in-${path}`} path={path} label="x⊕a" color="#a78bfa" start={0.25} end={0.32} duration={duration} />
        ))}
        {starOutgoingPaths.map((path) => (
          <DataPacket key={`mpsu-beaver-out-${path}`} path={path} label="⊕sum" color="#f59e0b" start={0.35} end={0.42} duration={duration} />
        ))}
        {starIncomingPaths.map((path) => (
          <DataPacket key={`mpsu-shuffle-in-${path}`} path={path} label="z" color="#2563eb" start={0.49} end={0.56} duration={duration} />
        ))}
        {shuffleForwardPaths.map((path, index) => (
          <DataPacket
            key={`mpsu-shuffle-chain-${path}`}
            path={path}
            label="z′"
            color="#00d978"
            start={0.58 + index * 0.08}
            end={0.65 + index * 0.08}
            duration={duration}
          />
        ))}
        {starIncomingPaths.map((path) => (
          <DataPacket key={`mpsu-result-${path}`} path={path} label="share" color="#00ff99" start={0.86} end={0.94} duration={duration} />
        ))}
      </g>
    </g>
  )
}

function MpsiCardTraffic({ mode }: { mode: 'mpsic' | 'mpsics' }) {
  if (mode === 'mpsics') {
    const duration = 36

    return (
      <g>
        <g aria-hidden="true">
          <circle cx="405" cy="106" r="4" fill="#2563eb" className="protocol-phase-motion" />
          <PhaseLabel text="双路 OPPRF · indicator / item → P0" start={0} end={0.18} duration={duration} initiallyVisible />
          <PhaseLabel text="Beaver 乘法 · 参与方 ⇄ P0" start={0.2} end={0.32} duration={duration} />
          <PhaseLabel text="XOR Shuffle · 汇聚后按 P0 → P1 → P2 → P3 置换" start={0.34} end={0.52} duration={duration} />
          <PhaseLabel text="ADD Shuffle · 沿同一拓扑再次置换" start={0.53} end={0.71} duration={duration} />
          <PhaseLabel text="交集指示重构 · share → P0" start={0.72} end={0.8} duration={duration} />
          <PhaseLabel text="交集位置下发 · P0 → P1 / P2 / P3" start={0.82} end={0.89} duration={duration} />
          <PhaseLabel text="局部和回传 · P1 / P2 / P3 → P0" start={0.91} end={0.99} duration={duration} />
        </g>

        <g aria-hidden="true">
          {starIncomingPaths.map((path) => (
            <DataPacket key={`psics-ind-${path}`} path={path} label="ind" color="#2563eb" start={0.025} end={0.1} duration={duration} />
          ))}
          {starIncomingPaths.map((path) => (
            <DataPacket key={`psics-item-${path}`} path={path} label="item" color="#f472b6" start={0.105} end={0.17} duration={duration} />
          ))}
          {starIncomingPaths.map((path) => (
            <DataPacket key={`psics-beaver-in-${path}`} path={path} label="x⊕a" color="#a78bfa" start={0.22} end={0.26} duration={duration} />
          ))}
          {starOutgoingPaths.map((path) => (
            <DataPacket key={`psics-beaver-out-${path}`} path={path} label="⊕sum" color="#f59e0b" start={0.28} end={0.32} duration={duration} />
          ))}
          {starIncomingPaths.map((path) => (
            <DataPacket key={`psics-xor-in-${path}`} path={path} label="xor" color="#2563eb" start={0.35} end={0.39} duration={duration} />
          ))}
          {shuffleForwardPaths.map((path, index) => (
            <DataPacket
              key={`psics-xor-chain-${path}`}
              path={path}
              label="xor′"
              color="#00d978"
              start={0.4 + index * 0.045}
              end={0.44 + index * 0.045}
              duration={duration}
            />
          ))}
          {starIncomingPaths.map((path) => (
            <DataPacket key={`psics-add-in-${path}`} path={path} label="add" color="#2563eb" start={0.54} end={0.58} duration={duration} />
          ))}
          {shuffleForwardPaths.map((path, index) => (
            <DataPacket
              key={`psics-add-chain-${path}`}
              path={path}
              label="add′"
              color="#00d978"
              start={0.59 + index * 0.045}
              end={0.63 + index * 0.045}
              duration={duration}
            />
          ))}
          {starIncomingPaths.map((path) => (
            <DataPacket key={`psics-reconstruct-${path}`} path={path} label="share" color="#00ff99" start={0.74} end={0.8} duration={duration} />
          ))}
          {starOutgoingPaths.map((path) => (
            <DataPacket key={`psics-indicator-${path}`} path={path} label="BitInd" color="#f59e0b" start={0.83} end={0.89} duration={duration} />
          ))}
          {starIncomingPaths.map((path) => (
            <DataPacket key={`psics-sum-${path}`} path={path} label="sum" color="#f472b6" start={0.92} end={0.98} duration={duration} />
          ))}
        </g>
      </g>
    )
  }

  const duration = 20

  return (
    <g>
      <g aria-hidden="true">
        <circle cx="405" cy="106" r="4" fill="#2563eb" className="protocol-phase-motion" />
        <PhaseLabel text="OPPRF 上行 · P1 / P2 / P3 → P0" start={0} end={0.18} duration={duration} initiallyVisible />
        <PhaseLabel text="Beaver 乘法 · 参与方 ⇄ P0" start={0.2} end={0.38} duration={duration} />
        <PhaseLabel text="XOR Shuffle · 各方 → P0 → P1 → P2 → P3" start={0.4} end={0.76} duration={duration} />
        <PhaseLabel text="数量重构 · P1 / P2 / P3 → P0" start={0.78} end={0.92} duration={duration} />
      </g>

      <g aria-hidden="true">
        {starIncomingPaths.map((path) => (
          <DataPacket key={`psic-opprf-${path}`} path={path} label="OPPRF" color="#2563eb" start={0.03} end={0.15} duration={duration} />
        ))}
        {starIncomingPaths.map((path) => (
          <DataPacket key={`psic-beaver-in-${path}`} path={path} label="x⊕a" color="#a78bfa" start={0.22} end={0.29} duration={duration} />
        ))}
        {starOutgoingPaths.map((path) => (
          <DataPacket key={`psic-beaver-out-${path}`} path={path} label="⊕sum" color="#f59e0b" start={0.31} end={0.37} duration={duration} />
        ))}
        {starIncomingPaths.map((path) => (
          <DataPacket key={`psic-shuffle-in-${path}`} path={path} label="z" color="#2563eb" start={0.42} end={0.49} duration={duration} />
        ))}
        {shuffleForwardPaths.map((path, index) => (
          <DataPacket
            key={`psic-shuffle-chain-${path}`}
            path={path}
            label="z′"
            color="#00d978"
            start={0.52 + index * 0.08}
            end={0.59 + index * 0.08}
            duration={duration}
          />
        ))}
        {starIncomingPaths.map((path) => (
          <DataPacket key={`psic-result-${path}`} path={path} label="share" color="#00ff99" start={0.8} end={0.9} duration={duration} />
        ))}
      </g>
    </g>
  )
}

export default function ProtocolTopology({ variant, trafficMode = variant, className, ...props }: ProtocolTopologyProps) {
  const copy = topologyCopy[variant]
  const cyanMarkerId = `topology-${variant}-cyan-arrow`
  const greenMarkerId = `topology-${variant}-green-arrow`
  const patternId = `topology-${variant}-grid`

  return (
    <svg
      viewBox="0 0 1200 675"
      role="img"
      aria-labelledby={`topology-${variant}-title topology-${variant}-description`}
      className={className}
      fontFamily='"Noto Sans CJK SC", "Microsoft YaHei", Arial, sans-serif'
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title id={`topology-${variant}-title`}>{`${copy.title} ${copy.accent}通信拓扑`}</title>
      <desc id={`topology-${variant}-description`}>{copy.description}</desc>
      <defs>
        <linearGradient id="topology-node-surface" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#132019" />
          <stop offset="1" stopColor="#080d0a" />
        </linearGradient>
        <pattern id={patternId} width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="#17241d" strokeWidth="1" />
          <circle cx="0" cy="0" r="1.2" fill="#2a3d34" />
        </pattern>
        <marker
          id={cyanMarkerId}
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="12"
          markerHeight="12"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
          overflow="visible"
        >
          <path
            d="M2 1.5L10 6 2 10.5"
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
        <marker
          id={greenMarkerId}
          viewBox="0 0 12 12"
          refX="10"
          refY="6"
          markerWidth="12"
          markerHeight="12"
          markerUnits="userSpaceOnUse"
          orient="auto"
          overflow="visible"
        >
          <path
            d="M2 1.5L10 6 2 10.5"
            fill="none"
            stroke="#00d978"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>

      <rect width="1200" height="675" fill="#050806" />
      <rect width="1200" height="675" fill={`url(#${patternId})`} opacity="0.62" />

      {variant === 'mpsu' ? (
        <>
          <path d="M28 59H220l18-18h62" fill="none" stroke="#00ff99" strokeWidth="1" opacity="0.8" />
          <path d="M1172 59H980l-18-18h-62" fill="none" stroke="#00ff99" strokeWidth="1" opacity="0.8" />
          <circle cx="300" cy="41" r="3" fill="#2563eb" />
          <circle cx="900" cy="41" r="3" fill="#2563eb" />
          <text x="600" y="51" fill="#ffffff" fontSize="33" fontWeight="750" textAnchor="middle">
            <tspan>MPSU · </tspan>
            <tspan fill="#2563eb">多方隐私集合求并集</tspan>
          </text>
          <text x="600" y="82" fill="#2563eb" fontSize="20" fontWeight="650" textAnchor="middle">
            Mesh + P0 星型 + 链式 Shuffle
          </text>
        </>
      ) : (
        <>
          <path d="M28 59H245l18-18h74" fill="none" stroke="#00ff99" strokeWidth="1" opacity="0.8" />
          <path d="M1172 59H955l-18-18h-74" fill="none" stroke="#00ff99" strokeWidth="1" opacity="0.8" />
          <circle cx="337" cy="41" r="3" fill="#2563eb" />
          <circle cx="863" cy="41" r="3" fill="#2563eb" />
          <text x="600" y="54" fill="#ffffff" fontSize="36" fontWeight="750" textAnchor="middle">
            <tspan>{copy.title} · </tspan>
            <tspan fill="#2563eb">{copy.accent}</tspan>
          </text>
          <text x="600" y="86" fill="#b7c2bc" fontSize="20" textAnchor="middle">
            {copy.description}
          </text>
        </>
      )}

      {variant === 'mpsu' ? (
        <>
          <MpsuMeshLinks />
          <StarLinks markerId={cyanMarkerId} />
          <ShuffleLinks markerId={greenMarkerId} />

          <ProtocolNode x={105} y={245} label="P1" role="参与方节点" />
          <ProtocolNode x={520} y={220} label="P0" role="中心节点" central />
          <ProtocolNode x={965} y={135} label="P2" role="参与方节点" />
          <ProtocolNode x={965} y={355} label="P3" role="参与方节点" />

          <MpsuTraffic />
          <MpsuLegend />
          <g transform="translate(320 572)">
            <rect width="850" height="62" rx="8" fill="#0d1511" stroke="#2a3d34" strokeWidth="1.25" />
            <circle cx="31" cy="31" r="15" fill="none" stroke="#2563eb" strokeWidth="1.8" />
            <text x="31" y="37" fill="#2563eb" fontSize="18" fontWeight="700" textAnchor="middle">i</text>
            <text x="61" y="38" fill="#b7c2bc" fontSize="17">{copy.footer}</text>
          </g>
        </>
      ) : (
        <>
          {variant === 'mpsi' && <NoDirectLinks />}
          <StarLinks markerId={cyanMarkerId} />
          {variant === 'mpsic' && <ShuffleLinks markerId={greenMarkerId} />}

          <ProtocolNode x={105} y={245} label="P1" role="参与方节点" />
          <ProtocolNode x={520} y={220} label="P0" role="中心节点" central />
          <ProtocolNode x={965} y={135} label="P2" role="参与方节点" />
          <ProtocolNode x={965} y={355} label="P3" role="参与方节点" />

          {variant === 'mpsi' && <MpsiTraffic />}
          {variant === 'mpsic' && (
            <MpsiCardTraffic mode={trafficMode === 'mpsics' ? 'mpsics' : 'mpsic'} />
          )}
          <StarLabels withShuffle={variant === 'mpsic'} />
          {variant === 'mpsic' && <ShuffleLabels />}

          <Legend variant={variant} />
          <g transform="translate(320 572)">
            <rect width="850" height="62" rx="8" fill="#0d1511" stroke="#2a3d34" strokeWidth="1.25" />
            <circle cx="31" cy="31" r="15" fill="none" stroke="#2563eb" strokeWidth="1.8" />
            <text x="31" y="37" fill="#2563eb" fontSize="18" fontWeight="700" textAnchor="middle">i</text>
            <text x="61" y="38" fill="#b7c2bc" fontSize="17">{copy.footer}</text>
          </g>
        </>
      )}
    </svg>
  )
}
