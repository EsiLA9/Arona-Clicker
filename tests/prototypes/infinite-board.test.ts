import { describe, expect, it } from 'vitest';
import { addEdge, createBoard, deleteNode, parseBoard } from '../../prototypes/infinite-board/src/model';
import type { Node } from '../../prototypes/infinite-board/src/types';

const node = (id: string): Node => ({ id, kind: 'plain', title: id, x: 0, y: 0, w: 8, h: 4, data: {} });

describe('Infinite Board model', () => {
  it('allows many-to-one directed edges and rejects self or duplicate edges', () => {
    const board = createBoard();
    board.nodes = [node('a'), node('b'), node('c')];

    expect(addEdge(board, 'a', 'b')).toBeDefined();
    expect(addEdge(board, 'c', 'b')).toBeDefined();
    expect(addEdge(board, 'a', 'b')).toBeUndefined();
    expect(addEdge(board, 'b', 'b')).toBeUndefined();
    expect(board.edges).toHaveLength(2);
  });

  it('deletes every edge attached to a removed node', () => {
    const board = createBoard();
    board.nodes = [node('a'), node('b'), node('c')];
    addEdge(board, 'a', 'b');
    addEdge(board, 'c', 'b');

    deleteNode(board, 'b');

    expect(board.nodes.map(item => item.id)).toEqual(['a', 'c']);
    expect(board.edges).toHaveLength(0);
  });

  it('validates schema and edge references while accepting a complete board', () => {
    const board = createBoard();
    board.nodes = [node('a'), node('b')];
    addEdge(board, 'a', 'b');
    expect(parseBoard(JSON.stringify(board))).toEqual(board);

    const broken = structuredClone(board);
    broken.edges[0]!.targetNodeId = 'missing';
    expect(() => parseBoard(JSON.stringify(broken))).toThrow(/引用无效/);
    expect(() => parseBoard(JSON.stringify({ ...board, schemaVersion: 2 }))).toThrow(/schemaVersion/);
  });
});
