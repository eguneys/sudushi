import { ticks, red, dark } from './shared'
import { batch, onCleanup, untrack, mapArray, createMemo, createSignal, createEffect, on } from 'soli2d-js'
import { Vec2 } from 'soli2d-js/web'
import { read, write, owrite } from './play'
import { useApp } from './app'

const id_gen = (() => { let id = 0; return () => ++id })()

export type Point = string

export function point(x: number, y: number) {
  return `${x} ${y} ${id_gen()}`
}

export function point_xy(p: Point) {
  return p.split(' ').map(_ => parseFloat(_))
}

export const point_zero = point(0, 0)

const pos_hit = (a: Vec2, b: Vec2) => {
  return a.distance(b) < 4
}

const letter_frames = ['a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','!','0','1','2','3','4','5','6','7','8','9', ',', '.']

export function format_letters(str: string) {
  return str.split('').map(_ => letter_frames.indexOf(_))
}


export default class GGame {

  get enemies() {
    return this._enemies.values
  }

  get projectiles() {
    return this._projectiles.values
  }

  constructor() {

    this.cursor = make_cursor()
    this.player = make_player(this)
    this._enemies = make_array([], _ => make_enemy((_) => this._enemies.remove(_), this, _))

    this._projectiles = make_array([], _ => make_projectile(() => this._projectiles.remove(_), player.pos.point, _))

    this.level = make_level(this, 0)
    this.health = make_health(this, 8)

    this.status = make_status(this)

    this.status.status = 'click around to move'

    let { player, cursor } = this

    const fire = (dir: Point) => {
      this._projectiles.push(dir)
    }

    createMemo(() => {
      this.projectiles.map(proj => {
        this.enemies.forEach(enemy => {

          if (pos_hit(enemy.pos.m_vs(), proj.pos.m_vs())) {
            proj.hit(enemy)
            enemy.take_hit(proj)
          }
        })
      })
    })

    setInterval(() => {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          let off = i/5 * Math.PI * 0.05
          let res = player.direction.add_angle(off + Math.PI + Math.random() * Math.PI * 0.2)
          fire(point(res.x, res.y))
        }, i / 5 * 100 + Math.random() * 100)
      }
    }, 200)

    setInterval(() => {
      for (let i = 0; i < 10; i++) {
        let off = i/10 * Math.PI * 0.1
        let res = player.direction.add_angle(off)
        fire(point(res.x, res.y))
      }
    }, 800)

    setInterval(() => {
      this._enemies.push(point(Math.random() * 320, Math.random() * 180))
    }, 940)

    setInterval(() => {
      this.level.up()
    }, 500)
    setInterval(() => {
      this.level.reset()
    }, 5000)

    setInterval(() => {
      this.health.down()
    }, 600)
    setInterval(()  => {
      this.health.max()
    }, 5000)
  }

}

function make_enemy(dispose: OnHandler, game: GGame, point: Point) {

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
    get tint() { return m_tint() },
    take_hit() {
      dispose()
    }
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
      batch(() => {
        pos.x = hover[0]
        pos.y = hover[1]
      })
    }

    if (lclick) {
      batch(() => {
        click.x = lclick[0]
        click.y = lclick[1]
      })
    }


    if (_rclick) {
      batch(() => {
        rclick.x = _rclick[0]
        rclick.y = _rclick[1]
      })
    }
  }))


  return {
    pos,
    click,
    rclick
  }
}

type OnHandler = () => void

function make_projectile(dispose: OnHandler, point: Point, _dir: Point) {

  let pos = make_position(...point_xy(point))

  let rx = make_rigid(pos.x, 1000, 0.92),
    ry = make_rigid(pos.y, 1000, 0.92)

  let t_force_decay = make_tween(1, 0, ticks.seconds - ticks.thirds)

  let dir = Vec2.make(...point_xy(_dir))

  createEffect(on(make_run(ticks.seconds), (_) => {
    if (_ === -1) {
      rx.force = 0
      ry.force = 0
      dispose()
    } else {
      rx.force = dir.x * t_force_decay.value * 2
      ry.force = dir.y * t_force_decay.value * 2
    }
  }))

  createEffect(() => {
    pos.x = rx.x
    pos.y = ry.x
  })



  return {
    pos,
    hit() {}
  }
}

function make_player(game: GGame) {

  let pos = make_position(100, 100)
  let target = make_position(100, 100)

  let rx = make_rigid(100, 1000, 0.92),
    ry = make_rigid(100, 1000, 0.92)



  let waypoints = make_array([], make_waypoint)

  let f_waypoint = createMemo(() => waypoints.head)

  createEffect(() => {
    let w = f_waypoint()
    if (w) {
      target.x = w.pos.x
      target.y = w.pos.y
    }
  })

  let m_dir = createMemo(() => target.m_vs().sub(pos.m_vs()).normalize)

  let m_distance = createMemo(() => pos.m_vs().distance(target.m_vs()))
  let m_reached = createMemo(() => m_distance() < 8)

  createEffect(on(m_reached, (v) => {
    createEffect(on(make_interval(ticks.seconds), () => {
    createEffect(on(make_run(ticks.half), (_) => {
      if (_ === -1) {
        rx.force = 0
        ry.force = 0
      } else {
        rx.force = m_dir().x * 0.5
        ry.force = m_dir().y * 0.5
      }
    }))
    }))
  }))


  createEffect(() => {
    pos.x = rx.x
    pos.y = ry.x
  })

  

  createEffect(() => {
    let p = point(...game.cursor.click.m_vs().vs)
    if (p !== point_zero) {
      waypoints.enqueue(p)
    }
  })

  createEffect(on(game.cursor.rclick.m_vs, () => {
    waypoints.clear()
  }))

  return {
    get direction() { return m_dir() },
    get projectiles() { return guns.values },
    m_distance,
    m_reached,
    pos,
    target,
    get waypoints() { return waypoints.values }
  }
}

function make_waypoint(point: Point) {

  let pos = make_position(...point_xy(point))

  return {
    pos
  }
}

function make_position(x, y) {
  let _x = createSignal(x, { equals: false })
  let _y = createSignal(y, { equals: false })

  let m_p = createMemo(() => point(read(_x), read(_y)))

  let m_vs = createMemo(() => Vec2.make(...point_xy(m_p())))

  return {
    get point() { return m_p() },
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

function make_tween(a: number, b: number, duration: number, easing: Ease = Ease.quad_in_out) {
  let elapsed = make_elapsed()

  let m_i_ = createMemo(() => Math.min(1, elapsed() / duration))
  let m_i = createMemo(() => easing(m_i_()))
  let m_value = createMemo(() => a * (1 - m_i()) + b * m_i())


  return {
    get i() { return m_i() },
    get value() { return m_value() },
    m_i,
    m_value
  }
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

export const TransitionGroup = props => {
  const resolved = children(() => props.children)

  const [combined, setCombined] = createSignal<Transform[]>()

  let p: Transform[] = []
  let first = true
  createComputed(() => {
    const c = resolved() as Transform[]
    const comb = [...c]
    const next = new Set(c)
    const prev = new Set(p)

    for (let i = 0; i < c.length; i++) {
      const el = c[i]
      if (!first && !prev.has(el)) {
      }
    }

    for (let i =0; i < p.length; i++) {
      const old = p[i]
      if (!next.has(old) && old._parent) {
        comb.splice(i, 0, old)

        on_exit(old, () => endTransition())

        function endTransition() {
          p = p.filter(i => i !== old)
          setCombined(p)
        }
      }
    }
    p = comb
    setCombined(comb)
  })
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
    get head() { return _()[0] },
    push(a: A) {
      write(_arr, _ => _.push(a))
    },
    enqueue(a: A) {
      write(_arr, _ => _.unshift(a))
    },
    dequeue() {
      let res
      write(_arr, _ => res = _.shift())
      return res
    },
    remove(a: A) {
      write(_arr, _ => _.splice(_.indexOf(a), 1))
    },
    clear() {
      owrite(_arr, [])
    }
  }
}

function make_status(game: GGame) {
  let _status = createSignal('')

  let m_letters = createMemo(() => read(_status))


  let m_status = createMemo(mapArray(() => format_letters(m_letters()), make_letter))


  return {
    m_status,
    set status(str: string) {
      owrite(_status, str)
    }
  }
}

const max_health = 10 
function make_health(game: GGame, health: number) {
  let _health = createSignal(health)

  let m_letters = createMemo(() =>
                             'health ' +
                               format_level(read(_health)))

  let m_health = createMemo(mapArray(() => format_letters(m_letters()), make_letter))


  return {
    m_health,
    down() {
      owrite(_health, _ => Math.max(0, _-1))
    },
    max() {
      owrite(_health, max_health)
    },
    quarter() {
      owrite(_health, _ => Math.min(max_health, _ + max_health / 4))
    },
  }
}

function make_level(game: GGame, level: number) {
  let _level = createSignal(level)

  let m_letters = createMemo(() =>
                             'level ' +
                               format_level(read(_level)))

  let m_level = createMemo(mapArray(() => format_letters(m_letters()), make_letter))

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


