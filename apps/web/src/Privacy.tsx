export function Privacy({ onClose }: { onClose: () => void }) {
  return (
    <section aria-label="Privacy" className="rules">
      <h1>Privacy</h1>
      <p>
        Apex Chess runs in your browser. No accounts, no sign-in, no ads, no analytics, and no
        cookies.
      </p>
      <h2>What is stored</h2>
      <p>
        Setups you save, and the time control you last picked for online play, are kept in this
        browser's local storage so you can reuse them. They stay on this device and are never sent
        to us. Clearing your browser's site data removes them.
      </p>
      <h2>Online games</h2>
      <p>
        When you play online, your locked setup and your moves go to our game server so your
        opponent can see them. The server keeps each room (both setups, the moves, and how the game
        ended) until 7 days after its last move, then deletes it. In a timed game it also keeps each
        player's time left and when the current turn began, so it can run the clock; these go with
        the room. No names or accounts are involved. This browser keeps a random room ticket so you
        can rejoin after a reload; leaving the room removes it.
      </p>
      <h2>Game archive</h2>
      <p>
        When an online game ends, the server also keeps an anonymous copy for setup statistics: the
        rules version, the time control, both setups, the moves, how the game ended (including on
        time), and the day it ended. It holds no clock times, room code, ticket, IP address, or time
        of day, so it cannot be linked back to you, and it is kept after the room is deleted.
        Statistics are published only as totals, never as single games. Games that ended before this
        notice was published were not archived.
      </p>
      <h2>Limits on requests</h2>
      <p>
        To stop abuse, the game server counts requests from each IP address over about a minute and
        refuses them when there are too many. The count is not stored.
      </p>
      <h2>What is not collected</h2>
      <p>
        Games you play against the computer or on one screen are not sent anywhere. The site is
        served by Cloudflare, which may keep standard server logs (such as IP address) for security
        and operation.
      </p>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </section>
  );
}
