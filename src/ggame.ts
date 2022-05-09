import { ticks } from './shared'
import { batch, onCleanup, untrack, mapArray, createMemo, createSignal, createEffect, on } from 'soli2d-js'
import { Vec2 } from 'soli2d-js/web'
import { read, write, owrite } from './play'
import { useApp } from './app'

export type Point = string

export function point(x: number, y: number) {
  return `${x} ${y}`
}

export function point_xy(p: Point) {
  return p.split(' ').map(_ => parseInt(_))
}

const letter_frames = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','!','0','1','2','3','4','5','6','7','8','9', ',', '.']

export function format_letters(str: string) {
  return str.split('').map(_ => letter_frames.indexOf(_))
}


export default class GGame {

  constructor() {

    this.cursor = make_cursor()
    this.player = make_player()
    this.enemy = make_enemy(this)

    this.level = make_level(this, 0)

    setInterval(() => {
      this.level.up()
    }, 500)
    setInterval(() => {
      this.level.reset()
    }, 5000)
  }

}

const max_level = 10
function format_level(level: number) {
  let filled = [...Array(level).keys()].map(_ => '!').join('')
  let unfilled = [...Array(max_level - level).keys()].map(_ => '.').join('')

  return unfilled + filled
}

function make_level(game: GGame, level: number) {
  let _level = createSignal(level)

  let m_level = make_letters(createMemo(() =>
                           'level ' + format_level(read(_level))))

  return {
    get level_digit() { return read(_level) },
    up() {
      owrite(_level, _ => Math.min(max_level, _+1))
    },
    reset() {
      owrite(_level, 0)
    },
    m_level
  }
}


function make_enemy(game: GGame) {

  let [{update}] = useApp()
  let pos = make_position(100, 100)

  let rx = make_rigid(100, 1000, 0.92),
    ry = make_rigid(100, 1000, 0.92)

  let m_dir = createMemo(() => game.cursor.pos.m_vs().sub(pos.m_vs()).normalize)
  let m_f_dir = createMemo(() => m_dir().scale(0.5))

  createEffect(on(make_interval(ticks.seconds), () => {
    createEffect(on(make_run(ticks.sixth), (_) => {
      if (_ === -1) {
        batch(() => {
          rx.force = 0
          ry.force = 0
        })
      } else {
        batch(() => {
          rx.force = m_f_dir().x
          ry.force = m_f_dir().y
        })
      }
    }))
  }))

  createEffect(on(update, () => {
    pos.x = rx.x
    pos.y = ry.x
  }))


  return {
    pos
  }
}


function make_cursor() {

  const [{mouse, update}] = useApp()

  let pos = make_position(0, 0)
  let click = make_position(0, 0)
  let rclick = make_position(0, 0)

  createEffect(on(update, () => {

    let { hover, lclick, rclick: _rclick } = mouse()

    if (hover) {
      pos.x = hover[0]
      pos.y = hover[1]
    }

    if (lclick) {
      click.x = lclick[0]
      click.y = lclick[1]
    }


    if (_rclick) {
      rclick.x = _rclick[0]
      rclick.y = _rclick[1]
    }
  }))


  return {
    pos,
    click,
    rclick
  }
}

function make_player() {


  let pos = make_position(100, 100)
  let target = make_position(100, 100)

  createEffect(on([() => target.x, () => target.y], ([tx, ty]) => {
    tween((v: number) => pos.x = v, pos.x, tx, ticks.seconds)
    tween((v: number) => pos.y = v, pos.y, ty, ticks.seconds)
  }))



  let m_distance = createMemo(() => pos.m_vs().distance(target.m_vs()))

  let m_reached = createMemo(() => m_distance() < 8)

  return {
    m_distance,
    m_reached,
    pos,
    target
  }
}


function make_position(x, y) {
  let _x = createSignal(x, { equals: false })
  let _y = createSignal(y, { equals: false })

  let m_p = createMemo(() => point(read(_x), read(_y)))

  let m_vs = createMemo(() => Vec2.make(...point_xy(m_p())))

  return {
    m_vs,
    get x() { return read(_x) },
    set x(v: number) { owrite(_x, v) },
    get y() { return read(_y) },
    set y(v: number) { owrite(_y, v) },
  }
}


function make_rigid(x, mass, air_friction) {
  let [{update}] = useApp()

  let _force = createSignal(0)

  let m_a = createMemo(() => read(_force) / mass)


  let m_v0_x

  let m_v_x = createMemo(on(update, ([dt, dt0]) => {
    return (m_v0_x?.() ?? 0) * air_friction * dt / dt0 + m_a() * dt * (dt + dt0) / 2
  }))

  let _x = createMemo((prev) => prev + m_v_x(), x)

  m_v0_x = createMemo(on(_x, (_x, x0) => {
    return _x - (x0 ?? x)
  }))

  return {
    get x() { return _x() },
    get vx() { return m_v_x() },
    set force(v: number) { owrite(_force, v) },
    get debug() { return [read(_force), m_v0_x()] }
  }
}

function make_letters(accessor: string) {
  return createMemo(mapArray(() => format_letters(accessor()), make_letter))
}

function make_letter(frame: number) {
  let m_tint = make_flip(ticks.thirds, 0xbc3e5b, 0xffffff)

  return {
    frame,
    get tint() { return m_tint() }
  }
}


function make_elapsed() {
  let [{update}] = useApp()

  return createMemo((prev) => {
    let [dt, dt0] = update()
    return prev + dt
  }, 0)
}

function make_interval(t: number) {
  
  let _ = createMemo(on(make_elapsed(), (e, e0) =>
    Math.floor(e0 / t) !== Math.floor(e / t)))

  return createMemo((prev) => _() ? prev : prev + 1, 0)
}

export function make_run(t: number) {
  let _ = on(make_elapsed(), e => e <= t)

  return createMemo(on(_, 
                       (_, _0, prev) => 
                       _ !== _0 ? (_ ? prev + 1 : -1) : 
                         !_ ? prev : prev + 1),
                       0)
}

export function make_flip<A>(t: number, a: A = true, b: A = false) {
  return createMemo(on(make_elapsed(), e => e <= t ? a : b))
}

type Ease = (t: number) => number

const Ease = {
  linear: t => t,
  quad_in: t => t * t,
  quad_out: t => -t * (t - 2),
  quad_in_out: t => t<.5 ? 2*t*t : -1+(4-2*t)*t,
  cubit_in: t => t * t * t
}

function tween(setter: (_: number) => void, a: number, b: number, duration: number, easing: Ease = Ease.quad_in_out) {

  let [{update}] = useApp()

  let elapsed = createSignal(0)

  createEffect(on(update, ([dt, dt0]) => owrite(elapsed, _ => _ += dt)))

  let m_i_ = createMemo(() => Math.min(1, read(elapsed) / duration))
  let m_i = createMemo(() => easing(m_i_()))

  let m_value = createMemo(() => a * (1 - m_i()) + b * m_i())

  createEffect(() => {
    setter(m_value())
  })
}


