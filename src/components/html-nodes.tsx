import { createElement, Fragment } from 'react'
import type { ReactNode } from 'react'

import type { HtmlElement, HtmlNode } from '#/lib/grammar'

const VOID = new Set(['br', 'img'])

interface Props {
  nodes: HtmlNode[]
  /** vẽ ô nhập cho chỗ trống của câu hỏi `item` */
  renderBlank?: (item: number) => ReactNode
  /** bọc phần tử là câu hỏi (vd. thêm nút chọn, dấu đúng/sai) */
  renderItem?: (item: number, el: HtmlElement, children: ReactNode) => ReactNode
}

/** Dựng cây HTML đã lọc ở server (chỉ thẻ và thuộc tính an toàn) thành React element */
export function HtmlNodes({ nodes, renderBlank, renderItem }: Props) {
  const render = (list: HtmlNode[]): ReactNode =>
    list.map((n, i) => {
      if (typeof n === 'string') return <Fragment key={i}>{n}</Fragment>
      if ('blank' in n) return <Fragment key={i}>{renderBlank?.(n.blank) ?? '______'}</Fragment>
      const props = {
        key: i,
        className: n.attrs?.class,
        colSpan: n.attrs?.colspan ? Number(n.attrs.colspan) : undefined,
        rowSpan: n.attrs?.rowspan ? Number(n.attrs.rowspan) : undefined,
        start: n.tag === 'ol' && n.attrs?.start ? Number(n.attrs.start) : undefined,
        ...(n.tag === 'img' ? { src: n.attrs?.src, alt: '', loading: 'lazy' as const } : {}),
      }
      if (VOID.has(n.tag)) return createElement(n.tag, props)
      const children = render(n.children)
      if (n.item != null && renderItem) {
        return createElement(n.tag, props, renderItem(n.item, n, children))
      }
      return createElement(n.tag, props, children)
    })
  return <>{render(nodes)}</>
}
