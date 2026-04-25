pragma solidity ^0.8.20;

contract TreasuryMultiSig {
    address[3] public admins;
    uint256 public constant MIN_SIGNATURES = 2;

    struct Tx {
        address to;
        uint256 amount;
        uint256 approvals;
        uint256 createdAt;
        bool executed;
    }

    mapping(uint256 => Tx) public txs;
    mapping(uint256 => mapping(address => bool)) public approved;

    uint256 public txCount;

    modifier onlyAdmin() {
        bool isAdmin = false;
        for (uint i = 0; i < 3; i++) {
            if (admins[i] == msg.sender) isAdmin = true;
        }
        require(isAdmin, "Not admin");
        _;
    }

    constructor(address[3] memory _admins) {
        admins = _admins;
    }

    function submitTx(address to, uint256 amount) external onlyAdmin {
        txs[txCount] = Tx({
            to: to,
            amount: amount,
            approvals: 0,
            createdAt: block.timestamp,
            executed: false
        });

        txCount++;
    }

    function approveTx(uint256 txId) external onlyAdmin {
        require(!approved[txId][msg.sender], "Already approved");

        approved[txId][msg.sender] = true;
        txs[txId].approvals++;
    }

    function executeTx(uint256 txId) external onlyAdmin {
        Tx storage txn = txs[txId];

        require(txn.approvals >= MIN_SIGNATURES, "Not enough approvals");

        if (txn.amount > 100000 ether) {
            require(
                block.timestamp >= txn.createdAt + 24 hours,
                "Timelock active"
            );
        }

        txn.executed = true;
        payable(txn.to).transfer(txn.amount);
    }

    receive() external payable {}
}