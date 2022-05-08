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

  _player: Player
  cursor: Cursor

  waypoints: Memo<Array<Waypoint>>

  get player() {
    return this._player
  }

  constructor() {

    this.cursor = make_cursor()
    this._player = make_player()

    let waypoints = createSignal([], { equals: false })

    this.waypoints = createMemo(mapArray(() => read(waypoints), (_) => make_waypoint(_)))

    let { player, cursor } = this
    createEffect(on([() => cursor.click.x, () => cursor.click.y], ([x, y]) => {
      if (x === 0 && y === 0) { return }
      write(waypoints, _ => _.push(point(x, y)))
    }))

    /*
    createEffect(on([() => cursor.rclick.x, () => cursor.rclick.y], ([x, y]) => {
      write(waypoints, _ => _.splice(-1))
    }))
   */

    createEffect(() => {
      let _waypoints = this.waypoints()
      if (_waypoints.length > 0) {
        player.target.x = _waypoints[0].pos.x
        player.target.y = _waypoints[0].pos.y
      } 
    })

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

  let m_vs = createMemo(() => Vec2.make(read(_x), read(_y)))

  return {
    m_vs,
    get x() { return read(_x) },
    set x(v: number) { owrite(_x, v) },
    get y() { return read(_y) },
    set y(v: number) { owrite(_y, v) },
  }
}
