export type WelcomeBlock =
	{ type: 'p'; text: string } | { type: 'ul'; items: string[] } | { type: 'h3'; text: string };

export interface WelcomeSection {
	title: string;
	blocks: WelcomeBlock[];
}

export interface WelcomeGuide {
	title: string;
	intro: WelcomeBlock[];
	sections: WelcomeSection[];
	outro: WelcomeBlock[];
}

const p = (text: string): WelcomeBlock => ({ type: 'p', text });
const ul = (...items: string[]): WelcomeBlock => ({ type: 'ul', items });
const h3 = (text: string): WelcomeBlock => ({ type: 'h3', text });

/** The short version for people who just want the essentials. Text uses **bold** markers. */
export const simpleGuide: WelcomeGuide = {
	title: 'Welcome to Secret Santa!',
	intro: [
		p('Welcome! This page explains how to take part in the gift exchange.'),
		p('There are three simple steps: join the event, share gift ideas, and take part in the draw.')
	],
	sections: [
		{
			title: '1. Your Wish List: Share Gift Ideas',
			blocks: [
				p('Add gift ideas to your wish list so others know what you might enjoy.'),
				ul(
					'Add each gift idea as a separate item.',
					'Include a name, description, or link so people can find the right gift.',
					'You can add a suggested price to help others plan.',
					'You can update your list at any time.'
				),
				p(
					'**Suggested prices are only guidelines.** You do not need to spend an exact amount or buy everything on someone’s list.'
				),
				p(
					'For example, if you would like to suggest $30 worth of gifts, you could add three separate ideas: one for $5, one for $10, and one for $15. This gives people more choices.'
				)
			]
		},
		{
			title: '2. The Draw: Find Out Who You Are Buying For',
			blocks: [
				p('Once everyone has joined the event, the organizer will launch the draw.'),
				p(
					'Each participant will be randomly assigned someone to buy a gift for. You can then visit **Your Draw** to see who you have been assigned and view their wish list.'
				),
				p('Participants from the same household will not be assigned to each other.'),
				p(
					'After the draw, you will also receive a Christmas code name. This code name helps keep your identity secret when communicating with other participants.'
				)
			]
		},
		{
			title: '3. Sharing Gifts: Browse Everyone’s Wish Lists',
			blocks: [
				p('Wish lists are shared with everyone in the event.'),
				p(
					'Whether you’re buying a gift for your assigned participant or simply looking for inspiration for someone else, you can browse anyone’s wish list.'
				),
				p(
					'You can reserve an item to let others know that you intend to buy it. This helps prevent people from buying the same gift.'
				),
				p(
					'You do not have to choose a gift from the wish list. The ideas are there to help you find something the person will enjoy.'
				)
			]
		},
		{
			title: '4. Messages: Ask Questions Without Revealing Your Identity',
			blocks: [
				p(
					'You can use the messaging system to ask questions about gifts or share information with other participants.'
				),
				p(
					'Messages use your Christmas code name instead of your real name, helping keep the exchange a surprise.'
				),
				p(
					'Check your messages from time to time. Someone may have a question about one of your gift ideas!'
				),
				p(
					'You can choose or change your code name from your profile after the draw has taken place.'
				)
			]
		},
		{
			title: '5. Enjoy the Gift Exchange!',
			blocks: [
				p(
					'Keep your wish list up to date, check your messages, and have fun finding the perfect gift.'
				),
				p('You can even reveal everyone’s Christmas code names at the holiday gathering!'),
				p(
					'**Remember:** Your Draw is where you find out who you are buying for. Wish Lists are shared with everyone, so you can get gift ideas for anyone in the group.'
				)
			]
		}
	],
	outro: [p('Happy holidays!')]
};

/** The longer, more detailed version. */
export const fullGuide: WelcomeGuide = {
	title: 'Welcome to this year’s Secret Santa!',
	intro: [
		p(
			'Welcome to our Secret Santa gift exchange! This application is here to help organize the event, make gift-giving easier, and hopefully make the experience a little more fun for everyone.'
		),
		p(
			'The idea is simple: everyone gets an opportunity to share things they would enjoy receiving, discover gift ideas for others, and participate in a randomly assigned Secret Santa exchange. Whether you’re buying for your assigned participant or simply looking for inspiration for someone else, the wish lists make it easier to find something thoughtful that people will genuinely appreciate.'
		),
		p('Here’s how everything works.')
	],
	sections: [
		{
			title: '1. Getting started: Create your account',
			blocks: [
				p(
					'The first step is to create your account and join the event. Once your account is created, you’ll automatically be signed in and taken to the welcome page.'
				),
				p(
					'Take a moment to complete your profile and choose a Christmas-themed code name. Your code name is your identity within the application and will be used in messages instead of your real name. This helps preserve the anonymity of the exchange and adds a little mystery to the experience.'
				),
				p(
					'During this initial phase, everyone should create their account, complete their profile, and start adding ideas to their wish lists.'
				),
				p(
					'**The event organizer will launch the draw once everyone has registered and is ready to participate.** Until then, you can explore the application, browse wish lists, and add gift ideas.'
				)
			]
		},
		{
			title: '2. Your wish list: Share ideas for gifts',
			blocks: [
				p(
					'Your wish list is one of the most important parts of the application. It’s where you can add individual gift ideas that other participants can browse when looking for something to buy you.'
				),
				p(
					'Try to be specific and add individual items rather than combining several things into one entry. For example, if you have several ideas that add up to approximately $30, add them separately:'
				),
				ul('A $5 item', 'A $10 item', 'A $15 item'),
				p(
					'This gives people the flexibility to choose one item, several smaller items, or a combination of suggestions that suits their budget and preferences.'
				),
				p(
					'Prices are only suggestions to help give people an idea of what an item costs. They are not strict requirements, and nobody is expected to purchase everything on your list or reach an exact total. The goal is to provide inspiration, not create a shopping obligation.'
				),
				p(
					'Clear and specific descriptions are especially helpful. If an idea is too broad or someone needs additional information to find the right item, they may contact you through the messaging system. Check your messages periodically and be ready to clarify your suggestions.'
				),
				p('You can continue adding or updating your wish list throughout the event.')
			]
		},
		{
			title: '3. The draw: Discover your assigned participant',
			blocks: [
				p(
					'Once everyone has created an account and confirmed their participation, the event organizer will launch the draw.'
				),
				p(
					'The application will randomly assign each participant someone to shop for. You will become that person’s Secret Santa, and someone else will be assigned to you.'
				),
				p(
					'The draw also respects household restrictions. Participants belonging to the same household will not be assigned to buy gifts for one another, helping make the exchange more interesting and ensuring everyone gets to participate in the spirit of the event.'
				),
				p(
					'After the draw has been launched, visit **Your Draw** from the top navigation bar. This page tells you who you’ve been assigned and gives you access to their wish list.'
				),
				p('Your assignment is private. Keep it secret to preserve the surprise!')
			]
		},
		{
			title: '4. Finding gifts: Browse wish lists',
			blocks: [
				p('Once the draw is complete, you can use the wish lists to help decide what to buy.'),
				p(
					'If you’re shopping for your assigned participant, you can browse their wish list and choose one or more suggestions. You are not required to purchase something from the list, however. The suggestions are there to help you find something the recipient would enjoy, and you’re always free to choose another gift.'
				),
				p(
					'You can also browse the wish lists of other participants, even if they aren’t the person assigned to you. This is intentional! One of the goals of the application is to make it easier for everyone to discover gift ideas for friends and family.'
				),
				p(
					'Sometimes finding a suitable gift is the hardest part of the holidays. Having access to everyone’s ideas gives you a little inspiration and helps you choose gifts that people are more likely to appreciate.'
				),
				h3('Reserving gifts'),
				p(
					'To help prevent duplicate purchases, you can reserve an item when you decide that you’re going to buy it.'
				),
				p(
					'Reserving an item lets other participants know that someone has already claimed that gift, reducing the chances of multiple people buying the same thing.'
				),
				p(
					'If you’re planning to purchase a particular item, remember to reserve it so others can choose something different.'
				)
			]
		},
		{
			title: '5. Messaging: Communicate without revealing your identity',
			blocks: [
				p(
					'Sometimes a wish list doesn’t provide quite enough information. Maybe you need clarification about a particular item, want to ask about someone’s preferences, or need to coordinate something related to a gift.'
				),
				p('The application includes a messaging system for exactly that purpose.'),
				p(
					'Messages use your assigned Christmas-themed code name rather than your real name, helping maintain anonymity throughout the exchange. This also creates an opportunity for a fun reveal at the Christmas party, when everyone can discover which code name belonged to whom!'
				),
				p(
					'Make a habit of checking the application periodically for new messages. Someone may be waiting for your response before deciding what to buy. Likewise, if someone contacts you about a wish list item, try to provide enough detail to help them make a decision.'
				),
				p(
					'Remember that clear wish list entries and timely responses make the experience better for everyone.'
				)
			]
		},
		{
			title: '6. Enjoy the exchange!',
			blocks: [
				p(
					'The application is designed to make organizing the Secret Santa exchange easier, but the real purpose is to have fun, discover thoughtful gift ideas, and make the holidays a little more enjoyable.'
				),
				p(
					'Participate by keeping your wish list up to date, checking your messages, respecting gift reservations, and keeping your assigned recipient a secret.'
				),
				p(
					'Most importantly, remember that the wish lists are there to inspire you, not limit you. Whether you follow someone’s suggestions exactly or find something completely different, the goal is to give something they’ll enjoy.'
				)
			]
		}
	],
	outro: [p('Have fun, happy shopping, and may the best Secret Santa win!')]
};
