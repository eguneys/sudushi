export type Angle = number

const half_turn = Math.PI

export function angle_diff(from: Angle, to: Angle) {
  return wrap_value(to - from, - half_turn, half_turn)
}

export function wrap_value(value: number, from: number, to: number) {
  let range = to - from
  return value - (range * Math.floor((value - from) / range))
}


