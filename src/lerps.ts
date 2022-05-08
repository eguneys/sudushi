import { ticks } from './shared'
import { batch, untrack, on, createMemo, createSignal, createEffect } from 'soli2d-js'
import { useApp } from './app'
import { read, write, owrite } from './play'
import { vec_transform_inverse_matrix } from './play'

export abstract class HasPosition {

  _ref?: Transform

  duration: number

  _x: LerpVal
  _y: LerpVal

  get x() {
    return this._x.value
  }

  get y() {
    return this._y.value
  }

  set x(x: number) {
    this._x.new_b(x)
  }

  set y(y: number) {
    this._y.new_b(y)
  }

  set lerp(v: number) {
    this._x.lerp = v
    this._y.lerp = v
  }

  constructor(x: number, y: number) {
    this._x = new LerpVal(x)
    this._y = new LerpVal(y)
  }

  _set_ref = (ref: Transform) => {
    this._ref = ref
  }


  has_dropped(drop: Vec2) {

    if (!this._ref) {
      return false
    }

    let hit = vec_transform_inverse_matrix(drop, this._ref)

    if (Math.floor(hit.x) === 0 && Math.floor(hit.y) === 0) {
      return true
    }

  }
}

export class LoopVal {
  i_val: TweenVal

  get value() {
    return this.i_val.value
  }

  constructor(a: number, b: number,
              duration: number,
              easing: Easing) {
                this.i_val = new TweenVal(a, b, duration, easing)

                createEffect(() => {
                  if (this.i_val.value === b) {
                    this.i_val.new_b(b, duration, a)
                  }
                })
              }
}


export class PingPongVal {

  static readonly A: boolean = true
  static readonly B: boolean = false

  i_val: TweenVal

  get value() {
    return this.i_val.value
  }

  get resolved() {
    return this.resolve !== undefined && this.i_val.resolved
  }

  _resolve: Signal<boolean | undefined>

  get resolve() {
    return read(this._resolve)
  }

  set resolve(v?: boolean) {
    owrite(this._resolve, v)
  }

  constructor(a: number, b: number,
              duration: number,
              easing: Easing) {

    this._resolve = createSignal()
    this.i_val = new TweenVal(a, b, duration, easing)

     createEffect(() => {
       let { resolve, i_val } = this

       if (resolve === PingPongVal.A) {
         untrack(() => {
           i_val.new_b(a)
         })
       } else if (resolve === PingPongVal.B) {
         untrack(() => {
           i_val.new_b(b)
         })
       } else {
         if (i_val.value === b) {
           i_val.new_b(a)
         } else if (i_val.value === a) {
           i_val.new_b(b)
         }
       }
     })
              }
}



export class LerpVal {

  _b: Signal<number>

  _i: Signal<number>

  get value() {
    return read(this._i)
  }

  lerp: number = 0.5

  constructor(a: number, b: number = a) {
    this._b = createSignal(b)
    this._i = createSignal(a)

    let [{update}] = useApp()

    createEffect(on(update, ([dt, dt0]) => {
      let value = this.lerp
      let dst = read(this._b)
      owrite(this._i, i => i * (1 - value) + dst * value)
    }))
  }


  new_b(b: number) {
    owrite(this._b, b)
  }
}
export class TweenVal {

  static linear = t => t
  static quad_in = t => t * t
  static quad_out = t => -t * (t - 2)
  static quad_in_out = t => t<.5 ? 2*t*t : -1+(4-2*t)*t 
  static cubit_in = t => t * t * t

  _elapsed: Signal<number> = createSignal(0)

  get _i() {
    return Math.min(1, read(this._elapsed) / this.duration)
  }

  get i() {
    return this.easing(this._i)
  }

  get has_reached() {
    return this.i === 1 && this._i0 !== this.i
  }

  get resolved() {
    return this.i === 1
  }

  get a() {
    return read(this._a)
  }

  get b() {
    return read(this._b)
  }

  _i0: number

  _a: Signal<number>
  _b: Signal<number>
  duration: number
  easing: Easing

  _value: Memo<number>


  get value() {
    return this._fvalue()
  }

  constructor(a: number,
              b: number,
              duration: number = ticks.sixth,
              easing: Easing = TweenVal.linear) {

                this._a = createSignal(a)
                this._b = createSignal(b)

                this.duration = duration
                this.easing = easing

                this._value = () => {
                  return this.a * (1 - this.i) + this.b * this.i
                }

                this._fvalue = createMemo(() => Math.round(this._value() * 100000) / 100000)

                let [{update}] = useApp()

                createEffect(on(update, ([dt, dt0]) => {
                  this._i0 = this.i
                  owrite(this._elapsed, _ => _ += dt)
                }))
              }

  new_b(b: number, duration = this.duration, a: number = this.value) {
    this.duration = duration
    batch(() => {
      owrite(this._b, b)
      owrite(this._a, a)
      owrite(this._elapsed, 0)
    })
  }
}


