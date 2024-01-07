import type { Connect, Plugin } from 'vite'
import { parseSync, traverse } from '@babel/core'
import type { ParserConfig } from '@swc/core'
import toBabel from 'swc-to-babel'
import { parse } from '@swc/core'
import MagicString from 'magic-string'
import { compat, visit } from 'woodpile'
import { queryParserMiddleware } from './middleware'
import { parseFilePath, parseJSXIdentifier } from './utils'
import { launchEditor } from './launch-editor'
function VitePluginReactInspector(): Plugin {
  return {
    name: 'vite-plugin-react-inspector',
    enforce: 'pre',
    apply: 'serve',
    config: () => {
      return {
        optimizeDeps: {
          include: ['react-dom'],
        },
      }
    },
    transform: async (code, id) => {
      const selfFileRegex = /vite-plugin-react-inspector\/src\/Toggle/
      if (
        (id.endsWith('.tsx') || id.endsWith('.jsx'))
        && !selfFileRegex.test(id)
      ) {
        const transformedCode = code
        const s = new MagicString(transformedCode)
        const parser: ParserConfig | undefined = id.endsWith('.tsx')
          ? { syntax: 'typescript', tsx: true, decorators: true }
          : id.endsWith('.ts') || id.endsWith('.mts')
            ? { syntax: 'typescript', tsx: false, decorators: true }
            : id.endsWith('.jsx')
              ? { syntax: 'ecmascript', jsx: true }
              : id.endsWith('.mdx')
                // eslint-disable-next-line operator-linebreak
                ? // JSX is required to trigger fast refresh transformations, even if MDX already transforms it
                  { syntax: 'ecmascript', jsx: true }
                : undefined
        if (!parser) return

        // const ast = await parse(code, {
        //   decorators: true,
        //   tsx: true,
        //   syntax: 'typescript',
        // })

        const ast = parseSync(code, {
          configFile: false,
          filename: id,
          ast: true,
          presets: [
            '@babel/preset-env',
            '@babel/preset-react',
            '@babel/preset-typescript',
          ],
        })

        // const babelAst = compat(ast) as any
        traverse(ast, {
          enter({ node }) {
            if (node.type === 'JSXElement') {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-expect-error
              if (node?.openingElement?.name?.object?.name === 'React')
                return

              const { start } = node
              const { column, line } = node?.loc?.start as any
              const toInsertPosition = start + parseJSXIdentifier(node.openingElement.name as any).length + 1
              const content = ` data-react-inspector="${id}:${line}:${column}"`
              s.appendLeft(toInsertPosition, content)

              console.log('node', JSON.stringify(node, null, 2))
            }
          },
        })

        const sourceMap = s.generateMap({
          source: id,
          includeContent: true,
        })
        return {
          code: s.toString(),
          map: sourceMap,
        }
      }
    },
  }
}

export default VitePluginReactInspector
