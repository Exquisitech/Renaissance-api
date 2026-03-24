Dynamic Treasury Allocation Engine

Goal:
Automatically rebalance internal protocol pools.

Description

Introduce on-chain logic to dynamically allocate funds between:

Betting liquidity pool

Spin reward pool

Staking reward reserve

Emergency reserve

Allocation ratios configurable via governance.

Acceptance Criteria

Pool balances stored separately

Allocation ratios adjustable

Rebalancing function callable by authorized role

Prevents allocation beyond total reserves

Emits reallocation event


