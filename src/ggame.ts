import { ticks, red, dark } from './shared'
import { batch, onCleanup, untrack, mapArray, createMemo, createSignal, createEffect, on } from 'soli2d-js'
import { Vec2 } from 'soli2d-js/web'
import { read, write, owrite } from './play'
import { useApp } from './app'
import { appra, angle_diff } from './util'

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
  return a.distance(b) < 8
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
    this._enemies = make_array([], _ => enemy_fuzzy(this, make_enemy(() => this._enemies.remove(_), this, _)))

    this._projectiles = make_array([],
                                   _ => 
    make_projectile(() => 
                    this._projectiles.remove(_), point(...player.front.vs), _))

    this.level = make_level(this, 0)
    this.health = make_health(this, 8)

    this.status = make_status(this)

    this.status.status = 'click around to move'

    let { player, cursor } = this

    const fire = (dir: Point) => {
      this._projectiles.push(dir)
    }

    createEffect(() => {
      this.projectiles.map(proj => {
        this.enemies.forEach(enemy => {

          if (pos_hit(enemy.pos.m_vs(), proj.pos.m_vs())) {
            enemy.take_hit(proj)
            proj.hit(enemy)
          }
        })
      })
    })

    /*
  let r = 0
    setInterval(() => {
      for (let i = 0; i < 10; i++) {
        let off = i/10 * Math.PI * 0.01
        let res = player.direction.add_angle(off + Math.sin(r * 30) * Math.PI * 0.08)
       // res = Vec2.from_angle(r * 3000)
        r += Math.PI * 0.0003
        fire(point(res.x, res.y))
      }
    }, 100)
   */

    this._enemies.push(point(Math.random() * 320, Math.random() * 180))
    setInterval(() => {
      this._enemies.push(point(Math.random() * 320, Math.random() * 180))
    }, 9040)

    setInterval(() => {
      this.level.up()
    }, 500)
    setInterval(() => {
      this.level.reset()
    }, 5000)

    setInterval(()  => {
      this.health.max()
    }, 5000)
  }

}

function enemy_fuzzy(game: GGame, enemy: Enemy) {

  let { rx, ry, m_p_dist } = enemy

  let target = make_position(100, 100)

  let m_target_dir = createMemo(() => target.m_vs().sub(enemy.pos.m_vs()))

  let m_dir = createMemo(() => m_target_dir().add_angle(Math.sign(1 - Math.random() * 2) * Math.PI * 0.5))

  createEffect(on(make_interval(ticks.seconds), () => {

    createEffect(on(make_run(ticks.half), () => {
      rx.force += m_dir().x
      ry.force += m_dir().y
    }))
  }))
 
  return enemy
}

function enemy_egg(game: GGame, enemy: Enemy) {

  let { rx, ry, m_dir, m_p_dist } = enemy

  const take_hit = (dir) => {
    rx.force = dir.x * 4
    ry.force = dir.y * 4
  }

  createEffect(on(make_interval(ticks.one * 2), () => {
    rx.force = rx.force * 0.01
    ry.force = ry.force * 0.01
  }))

  createEffect(() => {
    let p_dist = m_p_dist()

    if (p_dist < 18) {
      game.player.hit_fuzzy(take_hit)
    } else if (p_dist < 36) {
    } else {

    }
  })

  return enemy
}

function crawl(enemy: Enemy) {
  let { rx, ry, m_dir } = enemy
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
  return enemy
}

function make_enemy(dispose: OnHandler, game: GGame, point: Point) {

  let [{update}] = useApp()
  let pos = make_position(...point_xy(point))

  let rx = make_rigid(point_xy(point)[0], 1000, 0.92),
    ry = make_rigid(point_xy(point)[1], 1000, 0.92)

  let m_dir = createMemo(() => game.player.pos.m_vs().sub(pos.m_vs()).normalize)

  createEffect(on(update, () => {
    pos.x = rx.x
    pos.y = ry.x
  }))


  let m_tint = make_flip(ticks.half, red, dark)


  let m_p_dist = createMemo(() => game.player.pos.m_vs().distance(pos.m_vs()))

  return {
    pos,
    get tint() { return m_tint() },
    take_hit() {
      dispose()
    },
    rx,
    ry,
    m_dir,
    m_p_dist
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

  let dampen = 0.8

  createEffect(on(make_run(ticks.seconds), (_) => {
    if (_ === -1) {
      rx.force = 0
      ry.force = 0
      dispose()
    } else {
      rx.force = dir.x * t_force_decay.value * 2 * dampen
      ry.force = dir.y * t_force_decay.value * 2 * dampen
    }
  }))

  createEffect(() => {
    pos.x = rx.x
    pos.y = ry.x
  })



  return {
    get angle() { return dir.angle },
    pos,
    hit() {}
  }
}

function make_counter_loop(n: number) {
  let _ = createSignal(0)

  let _c = createSignal(0)

  return {
    get value() { return read(_) },
    increment() {
      owrite(_, _ => {
        _ = (_ + 1)
        if (_ >= n) {
          _ = 0
          owrite(_c, _ => _ + 1)
        }
        return _
      })
    },
    reset() {
      owrite(_c, 0)
      owrite(_, 0)
    },
    get c() { return read(_c) }
  }
}

function make_player(game: GGame) {

  let pos = make_position(100, 100)
  let target = make_position(100, 100)

  let friction = 0.91
  let rx = make_rigid(100, 1000, friction),
    ry = make_rigid(100, 1000, friction)

  let c_frame = make_counter_loop(7)

  let waypoints = make_array([], make_waypoint)

  let f_waypoint = createMemo(() => waypoints.head)

  createEffect(() => {
    let w = f_waypoint()
    if (w) {
      target.x = w.pos.x
      target.y = w.pos.y
    }
  })

  let m_target_dir = createMemo(() => target.m_vs().sub(pos.m_vs()).normalize)
  let m_target_angle = createMemo(() => m_target_dir().angle)

  let _dir = createSignal(Vec2.zero)

  let m_dir = createMemo(() => read(_dir))
  let m_dir_angle = createMemo(() => read(_dir).angle)

  let m_distance = createMemo(() => pos.m_vs().distance(target.m_vs()))
  let m_reached = createMemo(() => m_distance() < 8)

  let m_front = createMemo(() => pos.m_vs().add(read(_dir).scale(10)))

  let m_dampen_walk

  let [{update}] = useApp()
  createEffect(on(update, ([dt, dt0]) => {
    let da = m_dir_angle(),
      ta = m_target_angle()
    let a = appra(da, ta, angle_diff(da, ta) * 0.1)
    owrite(_dir, Vec2.from_angle(a))
  }))

  createEffect(on(m_reached, (v) => {
    createEffect(on(make_interval(ticks.five * 1.5), () => {
    createEffect(on(make_run(ticks.three), (_) => {
      if (_ === -1) {
        rx.force = 0
        ry.force = 0
        c_frame.increment()
      } else {
        rx.force = read(_dir).x * 0.5 * 2 * (m_dampen_walk?.() ?? 1)
        ry.force = read(_dir).y * 0.5 * 2 * (m_dampen_walk?.() ?? 1)
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


  let _hit_or = createSignal()
  let m_hit_or = createMemo(() => read(_hit_or))
  

  let l_hit_frame = make_counter_loop(3)

  createEffect(on(m_hit_or, hit_or => {
    if (hit_or) {
      l_hit_frame.reset()
      createEffect(on(make_interval(ticks.lengths), () => {
        l_hit_frame.increment()
      }))
    }
  }))

  createEffect(() => {
    if (l_hit_frame.c > 2) {
      owrite(_hit_or, undefined)
    }
  })

  let m_flip_hit_frame = createMemo(() => {
    if (m_hit_or()) {
      return l_hit_frame.value
    } else {
      return undefined
    }
  })

  m_dampen_walk = createMemo(() => {
    if (m_flip_hit_frame() === undefined) {
      return 1
    } else {
      return 0
    }
  })


  const hit_fuzzy = (f_take_hit) => {
    owrite(_hit_or, true)

    f_take_hit(m_dir())
  }

  return {
    get hit_frame() { return m_flip_hit_frame() },
    get front() { return m_front() },
    get frame() { return c_frame.value },
    get direction() { return read(_dir) },
    get angle() { return m_dir_angle() },
    get projectiles() { return guns.values },
    get waypoints() { return waypoints.values },
    m_distance,
    m_reached,
    pos,
    target,
    hit_fuzzy
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
    get force() { return read(_force) },
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

function make_trigger() {
  let _trigger = createSignal(false)

  createEffect(() => {
    if (read(_trigger)) {
      owrite(_trigger, false)
    }
  })

  return {
    get on() { return read(_trigger) },
    reset() { owrite(_trigger, true) }
  }
}

function make_elapsed_r() {
  let [{update}] = useApp()

  let t_reset = make_trigger()

  let m_value = createMemo((prev) => {
    let [dt, dt0] = update()
    return t_reset.on ? 0 : prev + dt
  }, 0)

  return {
    get value() { return m_value() },
    reset() { t_reset.reset() }
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

export function make_flip<A>(t: number, _a: Accessor<A> = () => true, _b: Accessor<A> = () => false) {

  let a = typeof _a === 'function' ? _a : () => _a
  let b = typeof _b === 'function' ? _b : () => _b

  return createMemo(on(make_elapsed(), e => e <= t ? a() : b()))
}

export function make_condition<A>(c: Accessor<boolean>, _a: Accessor<A> = () => true, _b: Accessor<A> = () => false) {

  return createMemo(on(c, v => v ? _a() : _b()))
}

type Ease = (t: number) => number

const Ease = {
  linear: t => t,
  quad_in: t => t * t,
  quad_out: t => -t * (t - 2),
  quad_in_out: t => t<.5 ? 2*t*t : -1+(4-2*t)*t,
  cubit_in: t => t * t * t
}

export function make_loop(a: number, b: number, duration: number) {
  let res = make_tween(a, b, duration)

  createEffect(() => {
    if (res.m_reached()) {
      res.b = b
    }
  })
  return res
}

function make_tween(a: number, b: number, duration: number, easing: Ease = Ease.quad_in_out) {
  let _b = createSignal(b)
  let elapsed = make_elapsed_r()

  let m_i_ = createMemo(() => Math.min(1, elapsed.value / duration))
  let m_i = createMemo(() => easing(m_i_()))
  let m_value = createMemo(() => a * (1 - m_i()) + read(_b) * m_i())

  let m_reached = createMemo(() => m_i() === 1)

  return {
    get i() { return m_i() },
    get value() { return m_value() },
    set b(v: number) { elapsed.reset(); owrite(_b, v) },
    m_i,
    m_value,
    m_reached
  }
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
      write(_arr, _ => {
        _.splice(_.indexOf(a), 1)
      })
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


