const { Telegraf, Markup } = require("telegraf")
const { message } = require('telegraf/filters')
const bot = new Telegraf(process.env.BOT_TOKEN)


const sendQuestion = async () => {
    bot.hears('Задать вопрос', async ctx => {
        await ctx.reply(`Для связи с оператором, вы будете перенаправлены в отдельный чат. Наши сотрудники помогут Вам и ответят на все вопросы\n Для продолжения нажмите ПЕРЕЙТИ`, 
            Markup.inlineKeyboard(
                [Markup.button.url('Перейти', 'https://t.me/bgtobj'),],
            )
        ) 
})
}

export {sendQuestion};