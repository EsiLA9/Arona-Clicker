import { describe, expect, it } from 'vitest';
import { addEdge, createBoard, createNode, deleteNode, parseBoard } from '../../prototypes/infinite-board/src/model';
import { SCHEMA_VERSION } from '../../prototypes/infinite-board/src/types';

const node = (id: string) => ({ ...createNode({ x: 0, y: 0 }, 'legacy', id), id });

describe('Infinite Board model', () => {
  it('allows many-to-one directed edges and rejects self or duplicate edges', () => {
    const board = createBoard();
    board.nodes = [node('a'), node('b'), node('c')];

    expect(addEdge(board, 'a', 'out', 'b', 'in')).toBeDefined();
    expect(addEdge(board, 'c', 'out', 'b', 'in')).toBeDefined();
    expect(addEdge(board, 'a', 'out', 'b', 'in')).toBeUndefined();
    expect(addEdge(board, 'b', 'out', 'b', 'in')).toBeUndefined();
    expect(board.edges).toHaveLength(2);
  });

  it('deletes every edge attached to a removed node', () => {
    const board = createBoard();
    board.nodes = [node('a'), node('b'), node('c')];
    addEdge(board, 'a', 'out', 'b', 'in');
    addEdge(board, 'c', 'out', 'b', 'in');
    expect(board.edges).toHaveLength(2);

    deleteNode(board, 'b');

    expect(board.nodes.map(item => item.id)).toEqual(['a', 'c']);
    expect(board.edges).toHaveLength(0);
  });

  it('validates schema and edge references while accepting a complete board', () => {
    const board = createBoard();
    board.nodes = [node('a'), node('b')];
    addEdge(board, 'a', 'out', 'b', 'in');
    expect(parseBoard(JSON.stringify(board))).toEqual(board);

    const broken = structuredClone(board);
    broken.edges[0]!.targetNodeId = 'missing';
    expect(() => parseBoard(JSON.stringify(broken))).toThrow(/引用无效/);
    expect(() => parseBoard(JSON.stringify({ ...board, schemaVersion: SCHEMA_VERSION + 1 }))).toThrow(/schemaVersion/);
  });
});
