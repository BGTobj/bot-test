import { Telegraf, Markup, Scenes, session } from 'telegraf'
import dotenv from 'dotenv'
dotenv.config()
import SceneGenerator from './scenes.js'
const curScene = new SceneGenerator()
const startPromo = curScene.startPromoScene()
const promo = curScene.getPromoScene()
const getPromoCity = curScene.getPromoCityScene()
const getListPromoDrugStore = curScene.getListPromoDrugStoreScene()
const getPromoDrugStore = curScene.getPromoDrugStoreScene()
const sendQuestion = curScene.sendQuestionScene()
const getCity = curScene.getCityScene()
const getListDrugStore = curScene.getListDrugStoreScene()
const getDrugStore = curScene.getDrugStoreScene()
const sendReview = curScene.sendReviewScene()
const getReviewMessage = curScene.getReviewMessageScene()
const getUserEmail = curScene.getUserEmailScene()
const postReview = curScene.postReviewScene()
const getReviewMessageMan = curScene.getReviewMessageManScene()
const myDrugStores = curScene.myDrugStoresScene()
const insertFavoriteDrugstore = curScene.insertFavoriteDrugstoreScene()
const deleteFavoriteDrugstore = curScene.deleteFavoriteDrugstoreScene()
const importantMessageCity = curScene.importantMessageCityScene()
const getImportantMessage = curScene.getImportantMessageScene()

const { BOT_TOKEN, GROUP_URL } = process.env
const bot = new Telegraf(BOT_TOKEN)

const stage = new Scenes.Stage([startPromo, promo, getPromoCity, getListPromoDrugStore, getPromoDrugStore, sendQuestion, getCity, getListDrugStore, getDrugStore, sendReview, getReviewMessage, getUserEmail, postReview, getReviewMessageMan, myDrugStores, insertFavoriteDrugstore, deleteFavoriteDrugstore, importantMessageCity, getImportantMessage]);
    bot.use(session());
    bot.use(stage.middleware());
    bot.hears("📢 Акции и спецпредложения", async ctx => { 
        ctx.scene.enter("startPromo")
    });
    bot.hears("❓ Задать вопрос", async ctx => {
        ctx.scene.leave();
        ctx.scene.enter("sendQuestion")
    });
    bot.hears("📍 Адреса и время работы", async ctx => { 
        ctx.scene.enter("getCity")
    });
    bot.hears("📝 Оставить отзыв", async ctx => { 
        ctx.scene.enter("sendReview")
    });
    bot.hears("⭐️ Мои аптеки", async ctx => {
        ctx.scene.enter("myDrugStores")
    });
    bot.hears("⚠️ Важные сообщения", async ctx => {
        ctx.scene.enter("importantMessageCity")
    });
    //команда запуска бота с приветствием и выбор пункта из главного меню
    bot.start(async (ctx) => {
        const userFirstName = ctx.message.chat.first_name;
        await ctx.reply(`Здравствуйте, ${userFirstName}, вы находитесь в телеграм-боте сети аптек "Монастырёв". Выберите, что вас интересует`, mainMenu)
    });


//главное меню
const mainMenu = Markup
    .keyboard([
        ['📢 Акции и спецпредложения', 
        '📍 Адреса и время работы'],
        ['⭐️ Мои аптеки', 
        '📝 Оставить отзыв'],
        ['❓ Задать вопрос',
        '⚠️ Важные сообщения'],
        ['💚 Наш канал']
    ])
    .oneTime()
    .resize()

//вывод главного меню по нажатию кнопки "в главное меню
const backMainMenu = Markup.inlineKeyboard(
    [[Markup.button.callback('↩️ Назад', 'back'),],
    [Markup.button.callback('🏠 В главное меню', 'mainMenu'),],
    ])
bot.action('mainMenu', async ctx => {
    await ctx.reply(`Выберите, что вас интересует`, mainMenu)
})

bot.hears(`💚 Наш канал`, ctx => {
    ctx.reply(`Переход в группу сети аптек "Монастырёв"\nДля продолжения нажмите <b>Перейти</b> 👇`, 
    {parse_mode: 'HTML', reply_markup: Markup.inlineKeyboard(
        [[Markup.button.url('⚠️ Перейти', GROUP_URL)],
        [Markup.button.callback('🏠 В главное меню', 'mainMenu')],],
    ).reply_markup}
                
            )
})


bot.launch()

