import { defineComponent } from 'vue'

interface Props {}

export default defineComponent<Props>(() => {
  return () => (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 64 64'
      width={64}
      height={64}
      class='text-on-surface'
      aria-hidden='true'
      focusable='false'
    >
      <g
        fill='none'
        stroke='currentColor'
        stroke-width={5}
        stroke-linecap='round'
        stroke-linejoin='round'
      >
        <circle
          cx={27}
          cy={27}
          r={19}
        />
        <path d='M41 41 L52 52' />
      </g>
      <text
        x={27}
        y={32}
        text-anchor='middle'
        font-family='Arial, Helvetica, sans-serif'
        font-size={15}
        font-weight={700}
        fill='currentColor'
      >
        KG
      </text>
    </svg>
  )
})
