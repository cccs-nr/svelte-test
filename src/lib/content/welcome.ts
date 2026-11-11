export type WelcomeBlock = { type: 'p'; text: string } | { type: 'ul'; items: string[] };

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

/** Text uses **bold** markers. */
export const welcomeGuide: WelcomeGuide = {
	title: 'Welcome to Secret Santa!',
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
			title: 'What is Secret Santa?',
			blocks: [
				p(
					'Secret Santa is a holiday tradition where each person draws the name of someone else in the group and buys them a gift. No one finds out who their gift came from until the exchange, which is what makes it fun for friends, family, classmates, and coworkers.'
				)
			]
		},
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
