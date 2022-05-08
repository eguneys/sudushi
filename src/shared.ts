const rate = 1000 / 60
export const ticks = {
  seconds: 60 * rate,
  half: 30 * rate,
  thirds: 20 * rate,
  lengths: 15 * rate,
  sixth: 10 * rate,
  five: 5 * rate,
  three: 3 * rate,
  one: 1 * rate
}

export type Color = number

export const dark: Color = 0
export const cyan: Color = 1
export const green: Color = 2
export const sand: Color = 3
export const red: Color = 4
export const purple: Color = 5
export const blue: Color = 6

export const colors = [dark, cyan, green, sand, red, purple, blue]


