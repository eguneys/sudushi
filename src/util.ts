export type Angle = number

const half_turn = Math.PI
const full_turn = 2 * half_turn

export function angle_diff(from: Angle, to: Angle) {
  return wrap_value(to - from, - half_turn, half_turn)
}

export function wrap_value(value: number, from: number, to: number) {
  let range = to - from
  return value - (range * Math.floor((value - from) / range))
}

export function appra(value: Angle, target: Angle, by: Angle) {
  let diff = angle_diff(value, target)
  let sign = Math.sign(diff)
  let offset = Math.min(Math.abs(by), Math.abs(diff)) * sign
  return wrap_value(value + offset, 0, full_turn)
}
