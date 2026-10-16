# Bug log


Complaints were collected from students and canteen staff over the last week,
Each one is what a person told us:

nobody has looked at the code yet,
working out the solution is your job for the following tasks! 


**There are 10 problem statements** Fix as many as you can!
Nobody is expected to finish all of them, but we suggest everyone to give a shot.
three fixed properly beats eight fixed badly :)

- For every one you fix, write it up in `LOG.md`, or any text file: how you reproduced it,
what was  wrong, and what you changed. **This is a requirement.**

you may work in any order. If one has you stuck for over an hour, leave it, **note
what you tried**, and move on  that note is worth marks too



### CC-01 : "The search suggestions are behind everything"

> "I start typing a dish name and the list of suggestions comes up, but
> it's stuck behind the rest of the page. I can only click the very top
> bit of it. The rest I can see, sort of, but clicking does nothing."

Reported by: a student, on a laptop



### CC-02: "Can't read anything in dark mode"

> "I switched the site to dark mode and now the dish names and the prices
> are almost invisible. The grey line under the name is fine, it's just
> the name and the price."

Reported by: a student. others say it looks like this the moment they
open the site, without changing anything



### CC-03: "The menu is wider than my phone"

> "I have to scroll sideways to see the whole menu, and the Add to Cart
> buttons on the right-hand dishes are cut off the edge of the screen"

Reported by: a student, on a phone



### CC-04: "The buttons don't work on my tablet"

> "Add to Cart does nothing. The star to save a dish does nothing either.
> The buttons look completely normal. It works fine on my laptop, and it
> works on my friend's phone. Only my tablet?"

Reported by: a student, on a tablet



### CC-05: "The category bar scrolls away on my phone"

> "On smaller screens, the category and filter bar scrolls away instead of
> staying visible at the top while I scroll down through the menu dishes."

Reported by: a student, on a phone



### CC-06: "I ordered more than they had"

> "The counter says only 2 samosas were left but it let me order 5, and
> the order went through fine. When I got there they only had 2?"

Reported by: canteen staff



### CC-07: "Cancelling makes it worse"

> "A student cancelled an order and the number of plates we have left went
> *down* again instead of coming back. Do that a few times and the system
> thinks we have none left when the kitchen is full"

Reported by: canteen staff



### CC-08: "An old coupon still works"

> "FRESHERS24 was last year's offer and it expired ages ago. Someone used
> it yesterday and got the discount?!!"

Reported by: canteen staff



### CC-09: "The menu shows more dishes than it should"

> "The page is supposed to show a few dishes at a time and load more as
> you scroll. It just dumps a much longer list straight away!"

Reported by: a student



### CC-10: "Sorting by price is backwards"

> "I picked 'price: low to high' and the most expensive things came first.
> I tried the other option and that gave me the cheap ones. Both are the
> wrong way round."

Reported by: a student.



## Notes

- Everything above is reproducible on a fresh clone. If something doesn't
  happen for you, inform us: a complaint that can't be reproduced is itself
  worth reporting
- Some of these need a particular screen size, theme or time of day to
  show up. Part of the task is working out what :)
- Stock can end up in a strange state while you test. Reset it with
  `git checkout -- backend/data/` and restart the server.
## Extra credit

None of this is required, and none of it is needed to clear the task. just brownie points

- **Bugs that are not on this list.** there are problems in this app
  nobody has reported yet: some in what you see on screen, some in what
  the server does. Find one, prove it, and write it up like the rest. Say
  how you noticed it.
- **A test.** Any script or check that fails before your fix and passes
  after.
- **An honest write up** something you spotted but could not fix, or a fix
  you are unsure about, explained clearly. scores better than silence!

Try to keep this in mind: an extra fix should not break anything else! there are **negative points** for this.

Good luck and have fun!