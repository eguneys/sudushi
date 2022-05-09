import { ticks, red, dark } from './shared'
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

  get enemies() {
    return this._enemies.values
  }

  constructor() {

    this.cursor = make_cursor()
    this.player = make_player(this)
    this.enemy = make_enemy(this, point(50, 50))
    this._enemies = make_array([], _ => make_enemy(this, _))

    this.level = make_level(this, 0)

    let { player, cursor } = this

    createEffect(() => {
      player.target.x = cursor.pos.x
      player.target.y = cursor.pos.y
    })

    setInterval(() => {
      this._enemies.push(point(Math.random() * 320, Math.random() * 180))
    }, 940)

    setInterval(() => {
      if (Math.random() < 0.08) {
        this._enemies.dequeue()
      }
    }, 100)

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

function make_array<A, B>(arr: Array<A>, map: (_: A) => B) {
  let _arr = createSignal(arr, { equals: false })

  let _ = createMemo(mapArray(_arr[0], map))

  return {
    get values() { return _() },
    push(a: A) {
      write(_arr, _ => _.push(a))
    },
    dequeue() {
      write(_arr, _ => _.shift())
    }
  }
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


function make_enemy(game: GGame, point: Point) {

  let [{update}] = useApp()
  let pos = make_position(...point_xy(point))

  let rx = make_rigid(point_xy(point)[0], 1000, 0.92),
    ry = make_rigid(point_xy(point)[1], 1000, 0.92)

  let m_dir = createMemo(() => game.player.pos.m_vs().sub(pos.m_vs()).normalize)

  createEffect(on(make_interval(ticks.seconds), () => {
    createEffect(on(make_run(ticks.sixth), (_) => {
      if (_ === -1) {
        batch(() => {
          rx.force = 0
          ry.force = 0
        })
      } else {
        batch(() => {
          rx.force = m_dir().x * 0.5
          ry.force = m_dir().y * 0.5
        })
      }
    }))
  }))

  createEffect(on(update, () => {
    pos.x = rx.x
    pos.y = ry.x
  }))


  let m_tint = make_flip(ticks.half, red, dark)

  return {
    pos,
    get tint() { return m_tint() }
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

function make_player(game: GGame) {


  let pos = make_position(100, 100)
  let target = make_position(100, 100)

  let rx = make_rigid(100, 1000, 0.92),
    ry = make_rigid(100, 1000, 0.92)


  let m_dir = createMemo(() => game.cursor.pos.m_vs().sub(pos.m_vs()).normalize)

  createEffect(on([() => target.x, () => target.y], ([tx, ty]) => {
    createEffect(on(make_run(ticks.sixth), (_) => {
      if (_ === -1) {
        rx.force = 0
        ry.force = 0
      } else {
        rx.force = m_dir().x * 0.5
        ry.force = m_dir().y * 0.5
      }
    }))
  }))


  let [{update}] = useApp()
  createEffect(on(update, () => {
    pos.x = rx.x
    pos.y = ry.x
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


