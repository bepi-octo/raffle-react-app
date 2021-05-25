import React, { useState } from 'react';
import { DAppProvider, useAccountPkh, useConnect, useOnBlock, useReady, useTezos, useWallet } from './dapp/dapp'
import './App.css';
import { APP_NAME, NETWORK, RAFFLE_ADDRESS } from './dapp/defaults';
import { BigMapAbstraction } from "@taquito/taquito";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import web3 from "web3";

type RaffleStorage = {
  admin: string;
  close_date: string;
  description: string;
  jackpot: number;
  players: [string];
  raffle_is_open: boolean;
  sold_tickets: BigMapAbstraction;
  winning_ticket_number_hash: string;
};


const Page = (props: { children: string | number | boolean | {} | React.ReactElement<any, string | React.JSXElementConstructor<any>> | React.ReactNodeArray | React.ReactPortal | null | undefined; }) => {
  return <div className="App"> {props.children} </div>
}



function ConnectionSection() {
  const connect = useConnect()
  const accountPkh = useAccountPkh()
  const tezos = useTezos()
  const [balance, setBalance] = React.useState(null)
  const handleConnect = React.useCallback(async () => {
    try {
      await connect(NETWORK, { forcePermission: true })
    } catch (err) {
      console.error(err.message)
    }
  }, [connect])


  const accountPkhPreview = React.useMemo(() => {
    console.log("usememo")
    if (!accountPkh) return undefined
    else {
      const accPkh = (accountPkh as unknown) as string
      const ln = accPkh.length
      return `${accPkh.slice(0, 7)}...${accPkh.slice(ln - 4, ln)}`
    }
  }, [accountPkh])

  const loadBalance = React.useCallback(async () => {
    console.log(loadBalance)
    if (tezos) {
      const tezosOk = tezos as any
      const bal = await tezosOk.tz.getBalance(accountPkh)
      setBalance(tezosOk.format('mutez', 'tz', bal).toString())
    }
  }, [tezos, accountPkh, setBalance])

  React.useEffect(() => {
    loadBalance()
  }, [loadBalance])

  useOnBlock(tezos, loadBalance)

  return <div>
    <div style={{ display: "grid", gridTemplateColumns: '1fr 1fr 1fr', margin: '0 auto', width: "500px" }}>
      <div>{balance}</div>
      <div>{accountPkhPreview}</div>
      <button onClick={handleConnect}>Connect account</button>
    </div>
  </div>

}

function RaffleInformation() {
  const wallet = useWallet();
  const ready = useReady();
  const tezos = useTezos();

  const [contract, setContract] = useState();
  const [storage, setStorage] = useState<RaffleStorage>();
  const [tickets, setTickets] = useState<string[]>([]);

  React.useEffect(() => {
    (async () => {
      if (tezos) {
        const ctr = await (tezos as any).wallet.at(RAFFLE_ADDRESS);
        debugger
        setContract(ctr);
      }
    })();
  }, [tezos]);

  const loadStorage = React.useCallback(async () => {
    if (contract) {
      const str = await (contract as any).storage();
      const ticket_ids = Array.from(Array(str.players.length).keys())
      const tckts = await str.sold_tickets.getMultipleValues(ticket_ids)
      setStorage(str)
      setTickets([...tckts.valueMap])
    }
  }, [contract]);

  React.useEffect(() => {
    loadStorage();
  }, [loadStorage]);

  useOnBlock(tezos, loadStorage)

  return (
    <div>
      <div>
        Administrator: {!!storage ? storage.admin.toString() : ""}
      </div>
      <div>
        Reward: {!!storage ? storage.jackpot.toString() : ""}
      </div>
      <div>
        Description: {!!storage ? storage.description.toString() : ""}
      </div>
      <div>
        Players:
        <div>
          {!!storage ? storage.players.map((value, index) => {
            return <li key={index}>{value}</li>
          }) : ""}
        </div>
      </div>
      <div>
        Tickets sold:
        <div>
          {tickets.map((value, index) => {
            return <li key={index}>{value[0]} : {value[1]}</li>
          })}
        </div>
      </div>

      <div>
        Closing date: {!!storage ? storage.close_date.toString() : ""}
      </div>
    </div>

  );
};

type launchRaffleButtonProps = { raffleReward: number; raffleDescription: string; raffleClosingDate: Date; raffleWinningHashNumber: string };

function LaunchRaffleButton({ raffleReward, raffleDescription, raffleClosingDate, raffleWinningHashNumber }: launchRaffleButtonProps) {
  const tezos = useTezos();
  const [contract, setContract] = useState(undefined);

  React.useEffect(() => {
    (async () => {
      if (tezos) {
        const ctr = await (tezos as any).wallet.at(RAFFLE_ADDRESS);
        setContract(ctr);
      }
    })();
  }, [tezos]);

  type launchRaffleParameters = { reward: number; description: string; closingDate: Date; winningTicketHash: string };

  const launchRaffleCallback = React.useCallback(
    ({ reward, description, closingDate, winningTicketHash }: launchRaffleParameters) => {
      return (contract as any).methods
        .openRaffle(reward, closingDate, description, web3.utils.asciiToHex(winningTicketHash).slice(2))
        .send({ amount: reward });
    },
    [contract]
  );
  return <button onClick={() => {
    launchRaffleCallback({
      reward: raffleReward,
      description: raffleDescription,
      closingDate: raffleClosingDate,
      winningTicketHash: raffleWinningHashNumber
    })
  }}>Launch</button>
}

function LaunchRaffleSection() {
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("100");
  const [closingDate, setClosingDate] = useState(new Date());
  const [winningTicketHash, setwinningTicketHash] = useState("");

  const setNewDate = (date: any) => {
    if (!!date) {
      setClosingDate(date)
    }
  }

  return <div style={{ border: "1px solid black" }}>
    <form>
      <label>
        Reward:
  <input type="text" name="reward" value={reward}
          onChange={(e) => setReward(e.target.value)} />
      </label>
      <br />
      <label>
        Description:
  <input type="text" name="description" value={description}
          onChange={(e) => setDescription(e.target.value)} />
      </label>
      <br />
      <label>
        Closing Date:
    <DatePicker selected={closingDate} onChange={date => setNewDate(date)}></DatePicker>
      </label>
      <br />
      <label>
        Winning Hash number:
    <input type="text" name="winningTicketHash" value={winningTicketHash}
          onChange={(e) => setwinningTicketHash(e.target.value)} />
      </label>
    </form>
    <LaunchRaffleButton raffleReward={parseInt(reward)} raffleDescription={description} raffleClosingDate={closingDate} raffleWinningHashNumber={winningTicketHash} ></LaunchRaffleButton>
  </div>

}

function BuyTicketButton() {
  const tezos = useTezos();
  const [contract, setContract] = useState(undefined);
  React.useEffect(() => {
    (async () => {
      if (tezos) {
        const ctr = await (tezos as any).wallet.at(RAFFLE_ADDRESS);
        setContract(ctr);
      }
    })();
  }, [tezos]);

  const launchRaffleCallback = React.useCallback(
    () => {
      return (contract as any).methods
        .buyTicket("unit")
        .send({ amount: 1 });
    },
    [contract]
  );
  return <button onClick={() => {
    launchRaffleCallback()
  }}>Buy</button>
}

function App() {
  return (
    <DAppProvider appName={APP_NAME}>
      <React.Suspense fallback={null}>
        <Page>
          <ConnectionSection></ConnectionSection>
          <RaffleInformation></RaffleInformation>
          <LaunchRaffleSection></LaunchRaffleSection>
          <BuyTicketButton></BuyTicketButton>
        </Page>
      </React.Suspense>
    </DAppProvider>
  );
}

export default App;