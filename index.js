import { Telegraf, Markup, Scenes, session } from 'telegraf'
import dotenv from 'dotenv'
dotenv.config()
import SceneGenerator from './scenes.js'
const curScene = new SceneGenerator()
const promo = curScene.getPromoScene()
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
const getContact = curScene.getContactScene()
const { BOT_TOKEN } = process.env
const bot = new Telegraf(BOT_TOKEN)

const stage = new Scenes.Stage([promo, sendQuestion, getCity, getListDrugStore, getDrugStore, sendReview, getReviewMessage, getUserEmail, postReview, getReviewMessageMan, myDrugStores, insertFavoriteDrugstore, deleteFavoriteDrugstore, getContact]);
    bot.use(session());
    bot.use(stage.middleware());
    bot.hears("Акции и спецпредложения", async ctx => { 
        ctx.scene.enter("promo")
    });
    bot.hears("Задать вопрос", async ctx => {
        ctx.scene.leave();
        ctx.scene.enter("sendQuestion")
    });
    bot.hears("Адреса и график работы аптек", async ctx => { 
        ctx.scene.enter("getCity")
    });
    bot.hears("Оставить отзыв", async ctx => { 
        ctx.scene.enter("sendReview")
    });
    bot.hears("Мои аптеки", async ctx => {
        ctx.scene.enter("myDrugStores")
    });
    //команда запуска бота с приветствием и выбор пункта из главного меню
    bot.start(async (ctx) => {
        const userFirstName = ctx.message.chat.first_name;
        await ctx.reply(`Welcome, ${userFirstName}`, mainMenu)
    });


//главное меню
const mainMenu = Markup
    .keyboard([
      'Акции и спецпредложения', 
      'Адреса и график работы аптек', 
      'Мои аптеки',
      'Оставить отзыв',
      'Задать вопрос'
    ])
    .oneTime()
    .resize()

//вывод главного меню по нажатию кнопки "в главное меню
const backMainMenu = Markup.inlineKeyboard(
    [Markup.button.callback('В главное меню', 'mainMenu'),],
    )
bot.action('mainMenu', async ctx => {
    await ctx.reply(`Выберите, что Вас интересует`, mainMenu)
})


bot.launch()

