import type { CodingProblemMeta } from '@/lib/coding-types';

export const BUNDLED_CODING_PROBLEMS: {
  courseCode: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  statement: string;
  meta: CodingProblemMeta;
}[] = [
  {
    courseCode: 'CS201ES',
    difficulty: 'easy',
    points: 10,
    statement: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.`,
    meta: {
      slug: 'two-sum',
      title: 'Two Sum',
      topics: ['Array', 'Hash Table'],
      constraints: '2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9\nOnly one valid answer exists.',
      examples: [
        { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' },
        { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
      ],
      functionName: 'twoSum',
      starterCode: {
        javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
var twoSum = function(nums, target) {
    // Write your code here
    
};`,
        python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        # Write your code here
        pass`,
      },
      timeLimitMs: 2000,
      compareMode: 'unordered-array',
      testCases: [
        { args: [[[2, 7, 11, 15], 9]], expected: [0, 1], isSample: true },
        { args: [[[3, 2, 4], 6]], expected: [1, 2], isSample: true },
        { args: [[[3, 3], 6]], expected: [0, 1] },
        { args: [[[1, 5, 3, 7], 8]], expected: [1, 2] },
      ],
    },
  },
  {
    courseCode: 'CS201ES',
    difficulty: 'easy',
    points: 10,
    statement: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    meta: {
      slug: 'valid-parentheses',
      title: 'Valid Parentheses',
      topics: ['String', 'Stack'],
      constraints: '1 <= s.length <= 10^4\ns consists of parentheses only \'()[]{}.\'',
      examples: [
        { input: 's = "()"', output: 'true' },
        { input: 's = "()[]{}"', output: 'true' },
        { input: 's = "(]"', output: 'false' },
      ],
      functionName: 'isValid',
      starterCode: {
        javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
var isValid = function(s) {
    // Write your code here
    
};`,
      },
      timeLimitMs: 2000,
      testCases: [
        { args: [['()']], expected: true, isSample: true },
        { args: [['()[]{}']], expected: true, isSample: true },
        { args: [['(]']], expected: false, isSample: true },
        { args: [['([)]']], expected: false },
        { args: [['{[]}']], expected: true },
      ],
    },
  },
  {
    courseCode: 'CS401PC',
    difficulty: 'medium',
    points: 15,
    statement: `Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.`,
    meta: {
      slug: 'maximum-subarray',
      title: 'Maximum Subarray',
      topics: ['Array', 'Dynamic Programming', 'Divide and Conquer'],
      constraints: '1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4',
      examples: [
        { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: 'The subarray [4,-1,2,1] has the largest sum 6.' },
        { input: 'nums = [1]', output: '1' },
        { input: 'nums = [5,4,-1,7,8]', output: '23' },
      ],
      functionName: 'maxSubArray',
      starterCode: {
        javascript: `/**
 * @param {number[]} nums
 * @return {number}
 */
var maxSubArray = function(nums) {
    // Kadane's algorithm
    
};`,
      },
      timeLimitMs: 2000,
      testCases: [
        { args: [[[-2, 1, -3, 4, -1, 2, 1, -5, 4]]], expected: 6, isSample: true },
        { args: [[[1]]], expected: 1, isSample: true },
        { args: [[[5, 4, -1, 7, 8]]], expected: 23, isSample: true },
        { args: [[[-1]]], expected: -1 },
        { args: [[[2, -1, 2, 3, -2, 5]]], expected: 8 },
      ],
    },
  },
  {
    courseCode: 'CS401PC',
    difficulty: 'medium',
    points: 15,
    statement: `Given the \`root\` of a binary tree, return its maximum depth.

A binary tree's maximum depth is the number of nodes along the longest path from the root node down to the farthest leaf node.`,
    meta: {
      slug: 'maximum-depth-binary-tree',
      title: 'Maximum Depth of Binary Tree',
      topics: ['Tree', 'DFS', 'BFS'],
      constraints: 'The number of nodes in the tree is in the range [0, 10^4].\n-100 <= Node.val <= 100',
      examples: [
        { input: 'root = [3,9,20,null,null,15,7]', output: '3' },
        { input: 'root = [1,null,2]', output: '2' },
      ],
      functionName: 'maxDepth',
      starterCode: {
        javascript: `/**
 * Definition for a binary tree node.
 * function TreeNode(val, left, right) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.left = (left===undefined ? null : left)
 *     this.right = (right===undefined ? null : right)
 * }
 */
/**
 * @param {TreeNode} root
 * @return {number}
 */
var maxDepth = function(root) {
    
};

// Helper: build tree from level-order array (for local testing)
function buildTree(arr) {
  if (!arr.length || arr[0] == null) return null;
  const root = { val: arr[0], left: null, right: null };
  const q = [root];
  let i = 1;
  while (q.length && i < arr.length) {
    const node = q.shift();
    if (arr[i] != null) { node.left = { val: arr[i], left: null, right: null }; q.push(node.left); }
    i++;
    if (i < arr.length && arr[i] != null) { node.right = { val: arr[i], left: null, right: null }; q.push(node.right); }
    i++;
  }
  return root;
}`,
      },
      timeLimitMs: 2000,
      testCases: [
        { args: [[{ val: 3, left: { val: 9, left: null, right: null }, right: { val: 20, left: { val: 15, left: null, right: null }, right: { val: 7, left: null, right: null } } }]], expected: 3, isSample: true },
        { args: [[{ val: 1, left: null, right: { val: 2, left: null, right: null } }]], expected: 2, isSample: true },
        { args: [[null]], expected: 0 },
      ],
    },
  },
];
