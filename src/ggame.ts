import { ticks } from './shared'
import { untrack, mapArray, createMemo, createSignal, createEffect, on } from 'soli2d-js'
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

export default class GGame {

  constructor() {

    this.cursor = make_cursor()
    this.player = make_player()
    this.enemy = make_enemy(this)
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

function make_run(t: number) {
  let _ = on(make_elapsed(), e => e <= t)

  return createMemo((prev) => !_() ? prev : prev + 1, 0)
}


function make_enemy(game: GGame) {

  let pos = make_position(0, 0)

  let rx = make_rigid(0, 1000, 0.92),
    ry = make_rigid(0, 1000, 0.92)

  let on_half = make_interval(ticks.seconds)


  createEffect(() => {
    console.log(game.cursor.pos.m_vs())
  })


  createEffect(() => {
    pos.x = rx.x
    rx.force = 0
    ry.force = 0
  })

  createEffect(on(on_half, () => {
    createEffect(on(make_run(ticks.sixth), () => {
      rx.force = 0.5 
    }))
  }))

  return {
    pos
  }
}

function make_waypoint(point: Point) {
  let pos = make_position(...point_xy(point))
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

const Ease = {
  linear: t => t,
  quad_in: t => t * t,
  quad_out: t => -t * (t - 2),
  quad_in_out: t => t<.5 ? 2*t*t : -1+(4-2*t)*t,
  cubit_in: t => t * t * t
}


function make_player() {


  let pos = make_position(0, 0)
  let target = make_position(0, 0)

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
    return (m_v0_x?.() || 0) * air_friction * dt / dt0 + m_a() * dt * (dt + dt0) / 2
  }))

  let _x = createMemo((prev) => prev + m_v_x(), x)

  let m_x0 = createMemo(on(_x, (_, x0) => {
    return x0 || x
  }))

  m_v0_x = createMemo(() => _x() - m_x0())

  return {
    get x() { return _x() },
    get vx() { return m_v_x() },
    set force(v: number) { owrite(_force, v) }
  }
}


function tween(setter: (_: number) => void, a: number, b: number, duration: number, easing: Easing = Ease.quad_in_out) {

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


